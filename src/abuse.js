(function(exports) {
    var nonTerminalChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890_";
    
    var errorTypes = {
        missingArrow: "missingArrow",
        missingClosingBrace: "missingClosingBrace",
        noProductionRule: "noProductionRule",
        ruleNeverUsed: "ruleNeverUsed"
    };

    var rightTrimmed = function(text) {
        return text.replace(/\s+$/, "");
    };
    
    var leftTrimmed = function(text) {
        return text.replace(/^\s+/, "");
    };

    var trimmed = function(text) {
        return rightTrimmed(leftTrimmed(text));
    };

    var nonTerminal = function(name, lineNumber, characterNumber) {
        return {
            text: "",
            name: name,
            lineNumber: lineNumber,
            characterNumber: characterNumber,
            isNonTerminal: true,
            expand: function(ruleSet, selector) {
                return ruleSet.expand(name, selector);
            },
            expandAll: function(ruleSet) {
                return ruleSet.expandAll(name);
            }
        };
    };

    var terminal = function(text) {
        return {
            text: text,
            isTerminal: true
        };
    };

    var sentence = nonTerminal("SENTENCE");

    var isNonTerminalCharacter = function(char) {
        return nonTerminalChars.indexOf(char) !== -1;
    };
    
    var parseRight = function(right, lineNumber, offset) {
        var nodes = [],
            dollarIndex,
            endOfNonTerminal,
            nonTerminalName,
            index = right.search(/\S/),
            remainder;
        
        while ((dollarIndex = right.indexOf("$", index)) !== -1) {
            remainder = right.slice(index, dollarIndex)
            if (remainder !== "") {
                nodes.push(terminal(remainder));
            }
            
            if (right[dollarIndex + 1] === "{") {
                endOfNonTerminal = right.indexOf("}", index);
                if (endOfNonTerminal === -1) {
                    return {
                        error: {
                            missingClosingBrace: true,
                            openingIndex: offset + dollarIndex + 1
                        }
                    };
                }
                nonTerminalName = right.substring(dollarIndex + 2, endOfNonTerminal);
                endOfNonTerminal += 1;
            } else {
                endOfNonTerminal = dollarIndex + 1;
                while (endOfNonTerminal < right.length &&
                       isNonTerminalCharacter(right[endOfNonTerminal])) {
                    endOfNonTerminal += 1;
                }
                nonTerminalName = right.substring(dollarIndex + 1, endOfNonTerminal);
            }
            
            nodes.push(nonTerminal(nonTerminalName, lineNumber, offset + dollarIndex));
            index = endOfNonTerminal;
        }
        remainder = rightTrimmed(right.slice(index));
        if (remainder !== "") {
            nodes.push(terminal(remainder));
        }
        
        return {
            nodes: nodes
        };
    };

    var parseLine = function(lineNumber, line) {
        var splitString = "->",
            components = line.split(splitString),
            right;
        if (components.length < 2) {
            return {
                error: {
                    str: "Missing symbol on line " + lineNumber + ": " + splitString,
                    type: errorTypes.missingArrow,
                    lineNumber: lineNumber
                }
            };
        }
        
        right = parseRight(components[1], lineNumber, components[0].length + splitString.length + 1);
        
        if (right.error) {
            return {
                error: {
                    str: "Missing closing brace on line " + lineNumber +
                        " (opening brace at character " +
                        right.error.openingIndex + ")",
                    type: errorTypes.missingClosingBrace,
                    lineNumber: lineNumber,
                    openingBraceCharacterNumber: right.error.openingIndex
                }
            };
        }
        
        return {
            left: nonTerminal(trimmed(components[0]).slice(1), lineNumber, 1),
            right: right.nodes
        };
    };
    
    var findOrphanedSymbols = function(rules, errors) {
        var startSymbols = [],
            startSymbolNames,
            nonTerminalsOnRhs = [],
            nonTerminalNames,
            missingProductionRuleStr = "No production rule for non-terminal $";
            
        rules.forEach(function(rule) {
            startSymbols.push(rule.left);
            rule.right.forEach(function(node) {
                if (node.isNonTerminal) {
                    nonTerminalsOnRhs.push(node);
                }
            });
        });
        
        startSymbolNames = startSymbols.map(function(node) {
            return node.name;
        });
        nonTerminalNames = nonTerminalsOnRhs.map(function(node) {
            return node.name;
        });
        nonTerminalNames.push(sentence.name);
        
        if (startSymbolNames.indexOf(sentence.name) === -1) {
            errors.push({
                str: missingProductionRuleStr + sentence.name,
                type: errorTypes.noProductionRule,
                nonTerminal: sentence.name
            });
        }
        nonTerminalsOnRhs.forEach(function(node) {
            if (startSymbolNames.indexOf(node.name) === -1) {
                errors.push({
                    str: missingProductionRuleStr + node.name +
                         " (line " + node.lineNumber + ", character " + node.characterNumber + ")",
                    type: errorTypes.noProductionRule,
                    nonTerminal: node.name,
                    lineNumber: node.lineNumber,
                    characterNumber: node.characterNumber
                });
            }
        });
        startSymbols.forEach(function(node) {
            if (nonTerminalNames.indexOf(node.name) === -1) {
                errors.push({
                    str: "Production rule with start symbol $" + node.name +
                         " is never used (line " + node.lineNumber + ")",
                    type: errorTypes.ruleNeverUsed,
                    lineNumber: node.lineNumber,
                    start: node.name
                });
            }
        });
    };
    
    var parse = function(text) {
        var lines = text.split("\n"),
            rules = [],
            errors = [],
            i,
            result;
        for (i = 0; i < lines.length; i += 1) {
            if (trimmed(lines[i]).length > 0) {
                result = parseLine(i + 1, lines[i]);
                if (result.error) {
                    errors.push(result.error);
                } else {
                    rules.push(result);
                }
            }
        }
        
        findOrphanedSymbols(rules, errors);
        
        return {
            rules: rules,
            errors: errors
        };
    };
    
    var buildRuleSet = function(ruleArray) {
        var rules = {},
            i,
            left,
            rule;
        for (i = 0; i < ruleArray.length; i += 1) {
            rule = ruleArray[i];
            left = rule.left.name;
            if (rules[left] === undefined) {
                rules[left] = [];
            }
            rules[left].push(rule.right);
        }
        return {
            expand: function(left, selector) {
                var possibleRules = rules[left];
                if (possibleRules === undefined) {
                    return undefined;
                }
                return possibleRules[selector(possibleRules.length)];
            },
            expandAll: function(left) {
                return rules[left] || [];
            }
        };
    };
    
    var generate = function(rules, selector, maxDepth) {
        var unexpandedNodes = [sentence],
            node,
            newUnexpandedNodes,
            i,
            result = [],
            ruleSet = buildRuleSet(rules),
            depth = -1,
            generateFromAllSentences = function() {
                var all = generateAll(rules, depth);
                return all[selector(all.length)];
            },
            undefined;
        while (unexpandedNodes.length > 0) {
            if (depth > maxDepth) {
                return generateFromAllSentences();
            }
            depth += 1;
            node = unexpandedNodes.pop();
            result.push(node.text);
            if (node.isNonTerminal) {
                newUnexpandedNodes = node.expand(ruleSet, selector);
                if (newUnexpandedNodes === undefined) {
                    return generateFromAllSentences();
                }
                for (i = newUnexpandedNodes.length - 1; i >= 0; i -= 1) {
                    unexpandedNodes.push(newUnexpandedNodes[i]);
                }
            }
        }
        return result.join("");
    };
    
    var reversed = function(array) {
        var copy = array.slice(0);
        copy.reverse();
        return copy;
    };
    
    var generateAllRecursive = function(ruleSet, currentResult, unexpandedNodes, depth) {
        var unexpandedNode,
            rules,
            rule,
            ruleIndex,
            i,
            results,
            subResults;
        if (unexpandedNodes.length === 0) {
            return [currentResult.join("")];
        }
        if (depth === -1) {
            return [];
        }
        unexpandedNode = unexpandedNodes.pop();
        currentResult = currentResult.slice(0);
        currentResult.push(unexpandedNode.text);
        if (unexpandedNode.isTerminal) {
            return generateAllRecursive(ruleSet, currentResult, unexpandedNodes, depth);
        }
        rules = unexpandedNode.expandAll(ruleSet);
        if (rules.length === 0) {
            return [];
        }
        
        results = [];
        for (ruleIndex = 0; ruleIndex < rules.length; ruleIndex += 1) {
            rule = rules[ruleIndex];
            subResults = generateAllRecursive(ruleSet, currentResult, unexpandedNodes.concat(reversed(rule)), depth - 1);
            for (i = 0; i < subResults.length; i += 1) {
                results.push(subResults[i]);
            }
        }
        return results;
    };
    
    var generateAll = function(rules, depth) {
        return generateAllRecursive(buildRuleSet(rules), [], [sentence], depth);
    };
    
    exports.nonTerminal = nonTerminal;
    exports.terminal = terminal;
    exports.parse = parse;
    exports.generate = generate;
    exports.generateAll = generateAll;
    exports.randomSelector = function(upper) {
        return Math.floor(Math.random() * upper);
    };
    exports.errors = errorTypes;
})(typeof ZWOBBLE === "undefined" ? exports : ZWOBBLE.abuse);
