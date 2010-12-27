(function(exports) {
    var nonTerminalChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890_";

    var trimmed = function(text) {
        return text.replace(/^\s+|\s+$/g, '');
    };

    var nonTerminal = function(name) {
        return {
            text: "",
            name: name,
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
    
    var parseRight = function(right) {
        var nodes = [],
            dollarIndex,
            endOfNonTerminal,
            nonTerminalName,
            index = right.search(/\S/);
        
        while ((dollarIndex = right.indexOf("$", index)) !== -1) {
            nodes.push(terminal(right.slice(index, dollarIndex)));
            
            if (right[dollarIndex + 1] === "{") {
                endOfNonTerminal = right.indexOf("}", index);
                if (endOfNonTerminal === -1) {
                    return {
                        error: {
                            missingClosingBrace: true,
                            openingIndex: dollarIndex + 1
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
            
            nodes.push(nonTerminal(nonTerminalName));
            index = endOfNonTerminal;
        }
        if (right.slice(index) !== "") {
            nodes.push(terminal(right.slice(index)));
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
                error: "Missing symbol on line " + lineNumber + ": " + splitString
            };
        }
        
        right = parseRight(components[1]);
        
        if (right.error) {
            return {
                error: "Missing closing brace on line " + lineNumber +
                    " (opening brace at character " +
                    (right.error.openingIndex + components[0].length + splitString.length + 1) +")"
            };
        }
        
        return {
            left: nonTerminal(trimmed(components[0]).slice(1)),
            right: right.nodes
        };
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
                    return [];
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
            all;
        while (unexpandedNodes.length > 0) {
            if (depth > maxDepth) {
                all = generateAll(rules, depth);
                return all[selector(all.length)];
            }
            depth += 1;
            node = unexpandedNodes.pop();
            result.push(node.text);
            if (node.isNonTerminal) {
                newUnexpandedNodes = node.expand(ruleSet, selector);
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
})(typeof ZWOBBLE === "undefined" ? exports : ZWOBBLE.abuse);
