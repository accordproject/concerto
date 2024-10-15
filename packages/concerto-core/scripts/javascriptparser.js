/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const doctrine = require('doctrine');
const acorn = require('acorn');
const walk = require('acorn-walk');
const Globalize = require('./globalize');

/**
 * Processes a single Javascript file (.js extension)
 *
 * @param {string} file - the file to process
 * @param {Object} fileProcessor - the processor instance to use to generate code
 * @private
 * @class
 * @memberof module:concerto-core
 */
class JavaScriptParser {

    /**
     * Create a JavaScriptParser.
     *
     * @param {string} fileContents - the text of the JS file to parse
     * @param {boolean} [includePrivates] - if true methods tagged as private are also returned
     * @param {number} [ecmaVersion] - the ECMAScript version to use
     * @param {boolean} [engineMode] - true if being used by engine for TP/ACL function Parsing
     */
    constructor(fileContents, includePrivates=false, ecmaVersion=2022) {
        let comments = [];
        this.tokens = [];
        let nodesToProcess = [];
        this.classes = [];
        this.functions = [];
        this.includes = [];

        const onComment = (block, text, start, end, line, column) => {
            comments.push({
                block,
                text,
                start,
                end,
                line,
                column
            });
        };

        const ast = acorn.parse(fileContents, {ecmaVersion, locations:true, onComment});

        nodesToProcess = [];
        walk.simple(ast, {
            FunctionDeclaration(node) {
                if (node.id && node.id.name) {
                    nodesToProcess.push(node);
                }
            },
            FunctionExpression(node) {
                if (node.id && node.id.name) {
                    nodesToProcess.push(node);
                }
            },
            ClassDeclaration(node) {
                nodesToProcess.push(node);
            },
            VariableDeclaration(node) {
                nodesToProcess.push(node);
            }
        });

        for (let n = 0; n < nodesToProcess.length; n++) {
            const statement = nodesToProcess[n];

            if (statement.type === 'VariableDeclaration') {
                const variableDeclarations = statement.declarations;

                for (let n = 0; n < variableDeclarations.length; n++) {
                    const variableDeclaration = variableDeclarations[n];

                    if (variableDeclaration.init && variableDeclaration.init.type === 'CallExpression' &&
                        variableDeclaration.init.callee.name === 'require') {
                        let requireName = variableDeclaration.init.arguments[0].value;
                        // we only care about the code we require with a relative path
                        if (requireName.startsWith('.')) {
                            this.includes.push(variableDeclaration.init.arguments[0].value);
                        }
                    }
                }
            } else if (statement.type === 'FunctionDeclaration' || (statement.type === 'FunctionExpression')) {
                const closestComment = JavaScriptParser.findCommentBefore(comments, statement.loc.start.line);
                let returnType = '';
                let visibility = '+';
                let parameterTypes = [];
                let parameterNames = [];
                let decorators = [];
                let throws = '';
                let example = '';
                let commentData;
                if (closestComment >= 0) {
                    const comment = comments[closestComment].text;
                    commentData = doctrine.parse(comment, {
                        unwrap: true,
                        sloppy: true
                    });
                    returnType = JavaScriptParser.getReturnType(comment);
                    visibility = JavaScriptParser.getVisibility(comment);
                    parameterTypes = JavaScriptParser.getMethodArguments(comment);
                    throws = JavaScriptParser.getThrows(comment);
                    decorators = JavaScriptParser.getDecorators(comment);
                    example = JavaScriptParser.getExample(comment);
                }

                if (visibility === '+' || includePrivates) {
                    for (let n = 0; n < statement.params.length; n++) {
                        parameterNames.push(statement.params[n].name);
                    }
                    const func = {
                        visibility: visibility,
                        returnType: returnType,
                        name: statement.id.name,
                        parameterTypes: parameterTypes,
                        parameterNames: parameterNames,
                        throws: throws,
                        decorators: decorators,
                        functionText: JavaScriptParser.getText(statement.start, statement.end, fileContents),
                        example: example,
                        commentData: commentData
                    };
                    this.functions.push(func);
                }
            } else if (statement.type === 'ClassDeclaration') {
                const closestComment = JavaScriptParser.findCommentBefore(comments, statement.loc.start.line);
                let privateClass = false;
                let d;
                if (closestComment >= 0) {
                    const comment = comments[closestComment].text;
                    d = doctrine.parse(comment, {
                        unwrap: true,
                        sloppy: true
                    });
                    privateClass = JavaScriptParser.getVisibility(comment) === '-';
                }

                if (privateClass === false || includePrivates) {
                    d = d || [];
                    const clazz = {
                        name: statement.id.name,
                        commentData: d
                    };
                    clazz.methods = [];

                    for (let n = 0; n < statement.body.body.length; n++) {
                        let thing = statement.body.body[n];

                        if (thing.type === 'MethodDefinition') {
                            const closestComment = JavaScriptParser.findCommentBefore(comments, thing.loc.start.line);
                            let returnType = '';
                            let visibility = '+';
                            let methodArgs = [];
                            let throws = '';
                            let decorators = [];
                            let example = '';
                            let commentData;
                            if (closestComment >= 0) {
                                const comment = comments[closestComment].text;
                                commentData = doctrine.parse(comment, {
                                    unwrap: true,
                                    sloppy: true
                                });
                                returnType = JavaScriptParser.getReturnType(comment);
                                visibility = JavaScriptParser.getVisibility(comment);
                                methodArgs = JavaScriptParser.getMethodArguments(comment);
                                decorators = JavaScriptParser.getDecorators(comment);
                                throws = JavaScriptParser.getThrows(comment);
                                example = JavaScriptParser.getExample(comment);
                            }
                            let name = thing.key.name;
                            if(!thing.key.name && thing.key.property.name){
                                name = thing.key.property.name;
                            }

                            commentData = commentData || [];
                            if (visibility === '+' || visibility === '~' || includePrivates) {
                                const method = {
                                    visibility: visibility,
                                    returnType: returnType,
                                    name: name,
                                    methodArgs: methodArgs,
                                    decorators: decorators,
                                    throws: throws,
                                    example: example,
                                    commentData: commentData
                                };
                                clazz.methods.push(method);
                            }
                        }
                    }

                    if (statement.superClass) {
                        clazz.superClass = statement.superClass.name;
                    }

                    this.classes.push(clazz);
                }
            }
        }
    }

    /**
     * Return the includes that were extracted from the JS file.
     *
     * @return {Object[]} information about each include
     */
    getIncludes() {
        return this.includes;
    }

    /**
     * Return the classes that were extracted from the JS file.
     *
     * @return {Object[]} information about each class
     */
    getClasses() {
        return this.classes;
    }

    /**
     * Return the methods that were extracted from the JS file.
     *
     * @return {Object[]} information about each method
     */
    getFunctions() {
        return this.functions;
    }

    /**
     * Return the tokens that were extracted from the JS file.
     *
     * @return {Object[]} information about each tokens
     */
    getTokens() {
        return this.tokens;
    }

    /**
     * Grab the text between a range
     *
     * @param {integer} rangeStart - the start of the range
     * @param {integer} rangeEnd - the end of the range
     * @param {string} source - the source text
     * @return {string} the text between start and end
     * @private
     */
    static getText(rangeStart, rangeEnd, source) {
        return source.substring(rangeStart, rangeEnd);
    }

    /**
     * Find the comments that are directly above a specific line number.
     * This is used when order of the nodes cannot be guaranteed but
     * limitation is that all comments must directly precede what they
     * are commenting (ie no blank lines)
     *
     * @param {string[]} comments - the end of the range
     * @param {integer} lineNumber - current linenumber
     * @return {integer} the comment index or -1 if there are no comments
     * @private
     */
    static findCommentBefore(comments, lineNumber) {
        let foundIndex = -1;

        for (let n = 0; n < comments.length; n++) {
            const comment = comments[n];
            const endComment = comment.column.line;

            if ((lineNumber-endComment) === 1) {
                foundIndex = n;
                break;
            }

        }
        return foundIndex;
    }

    /**
     * Grabs all the @ prefixed decorators from a comment block.
     * @param {string} comment - the comment block
     * @return {string[]} the @ prefixed decorators within the comment block
     * @private
     */
    static getDecorators(comment) {
        const re = /(?:^|\W)@(\w+)/g;
        let match;
        const matches = [];
        match = re.exec(comment);
        while (match) {
            matches.push(match[1]);
            match = re.exec(comment);
        }
        return matches;
    }

    /**
     * Extracts the visibilty from a comment block
     * @param {string} comment - the comment block
     * @return {string} the return visibility (either + for public, ~ for protected, or - for private)
     * @private
     */
    static getVisibility(comment) {
        const PRIVATE = 'private';
        const PROTECTED = 'protected';

        let parsedComment = doctrine.parse(comment, {
            unwrap: true,
            sloppy: true,
            tags: [PRIVATE, PROTECTED]
        });
        const tags = parsedComment.tags;

        if (tags.length > 0) {
            switch (tags[0].title) {
            case PRIVATE:
                return '-';
            case PROTECTED:
                return '~';
            default:
                return '+';
            }
        }
        return '+';
    }

    /**
     * Extracts the return type from a comment block.
     * @param {string} comment - the comment block
     * @return {string} the return type of the comment
     * @private
     */
    static getReturnType(comment) {
        const RETURN = 'return';
        const RETURNS = 'returns';

        let result = 'void';
        let parsedComment = doctrine.parse(comment, {
            unwrap: true,
            sloppy: true,
            tags: [RETURN, RETURNS]
        });

        const tags = parsedComment.tags;

        if (tags.length > 1) {
            let formatter = Globalize.messageFormatter('javascriptparser-malformedjsdoccommentmultiplereturns');
            throw new Error(formatter({
                comment: comment
            }));
        }

        tags.forEach((tag) => {
            if (tag.type) {
                if (!tag.type.name && !tag.type) {
                    let formatter = Globalize.messageFormatter('javascriptparser-malformedjsdoccomment');
                    throw new Error(formatter({
                        comment: comment
                    }));
                }

                if (tag.type.name) {
                    result = tag.type.name;
                } else if (tag.type.applications) {
                    if(!tag.type.applications[0].name && tag.type.applications[0].type === 'RecordType'){
                        result = 'Object[]';
                    } else {
                        result = tag.type.applications[0].name + '[]';
                    }
                } else if (tag.type.expression) {
                    result = tag.type.expression.name;

                }
            } else {
                let formatter = Globalize.messageFormatter('javascriptparser-malformedjsdoccomment');
                throw new Error(formatter({
                    comment: comment
                }));
            }
        });
        return result;
    }

    /**
     * Extracts the return type from a comment block.
     * @param {string} comment - the comment block
     * @return {string} the return type of the comment
     * @private
     */
    static getThrows(comment) {
        const THROWS = 'throws';
        const EXCEPTION = 'exception';
        let result = '';
        let parsedComment = doctrine.parse(comment, {
            unwrap: true,
            sloppy: true,
            tags: [THROWS, EXCEPTION]
        });

        const tags = parsedComment.tags;

        if (tags.length > 1) {
            let formatter = Globalize.messageFormatter('javascriptparser-malformedjsdoccommentmultipleexceptions');
            throw new Error(formatter({
                comment: comment
            }));
        }

        tags.forEach((tag) => {
            if (tag.type) {
                if (!tag.type.type || !tag.type.name) {
                    let formatter = Globalize.messageFormatter('javascriptparser-malformedjsdoccomment');
                    throw new Error(formatter({
                        comment: comment
                    }));
                }
                result = tag.type.name;
            } else {
                let formatter = Globalize.messageFormatter('javascriptparser-malformedjsdoccomment');
                throw new Error(formatter({
                    comment: comment
                }));
            }
        });

        return result;
    }

    /**
     * Extracts the method arguments from a comment block.
     * @param {string} comment - the comment block
     * @return {string} the the argument types
     * @private
     */
    static getMethodArguments(comment) {
        const TAG = 'param';
        let paramTypes = [];
        let parsedComment = doctrine.parse(comment, {
            unwrap: true,
            sloppy: true,
            tags: [TAG]
        });

        const tags = parsedComment.tags;

        // param is mentioned but not picked up by parser
        if (comment.indexOf('@' + TAG) !== -1 && tags.length === 0) {
            let formatter = Globalize.messageFormatter('javascriptparser-malformedjsdoccomment');
            throw new Error(formatter({
                comment: comment
            }));
        }

        tags.forEach((tag) => {
            if (tag.description) {
                //If description starts with }
                if (tag.description.trim().indexOf('}') === 0 ||
                    !tag.type ||
                    !tag.name) {
                    let formatter = Globalize.messageFormatter('javascriptparser-malformedjsdoccomment');
                    throw new Error(formatter({
                        comment: comment
                    }));
                }
            }
            if (tag.type.name) {
                if (tag.type.name.indexOf(' ') !== -1) {
                    let formatter = Globalize.messageFormatter('javascriptparser-malformedjsdoccomment');
                    throw new Error(formatter({
                        comment: comment
                    }));
                }
            }

            switch(tag.type.type) {
            case 'UnionType':
                if(tag?.type?.elements) {
                    paramTypes.push(tag.type.elements.map( e => e.name).join('|'));
                }
                else {
                    let formatter = Globalize.messageFormatter('javascriptparser-malformedjsdoccomment');
                    throw new Error(formatter({
                        comment: JSON.stringify(tag)
                    }));
                }
                break;
            case 'OptionalType':
                if(tag?.type?.expression?.type === 'TypeApplication') {
                    paramTypes.push(`${tag.type.expression.applications[0].name}[]`);
                }
                else if(tag?.type.expression?.name) {
                    paramTypes.push(`${tag?.type.expression?.name}?`);
                }
                else if(tag?.name) {
                    paramTypes.push(`${tag?.name}?`);
                }
                else {
                    let formatter = Globalize.messageFormatter('javascriptparser-malformedjsdoccomment');
                    throw new Error(formatter({
                        comment: JSON.stringify(tag)
                    }));
                }
                break;
            case 'AllLiteral':
                if(tag?.name) {
                    paramTypes.push(tag.name);
                }
                else {
                    let formatter = Globalize.messageFormatter('javascriptparser-malformedjsdoccomment');
                    throw new Error(formatter({
                        comment: JSON.stringify(tag)
                    }));
                }
                break;
            case 'NameExpression':
                if(tag?.type?.name) {
                    paramTypes.push(tag.type.name);
                }
                else {
                    let formatter = Globalize.messageFormatter('javascriptparser-malformedjsdoccomment');
                    throw new Error(formatter({
                        comment: JSON.stringify(tag)
                    }));
                }
                break;
            case 'TypeApplication':
                if(tag?.type?.applications) {
                    paramTypes.push(tag.type.applications.map(e => e.name).join(',') + '[]');
                }
                else {
                    let formatter = Globalize.messageFormatter('javascriptparser-malformedjsdoccomment');
                    throw new Error(formatter({
                        comment: JSON.stringify(tag)
                    }));
                }
                break;
            default:
                throw new Error(Globalize.messageFormatter('javascriptparser-unrecognizedjsdoccomment')({
                    comment: JSON.stringify(tag)
                }));
            }
        });
        return paramTypes;
    }

    /**
     * Extracts the example tag from a comment block.
     * @param {string} comment - the comment block
     * @return {string} the the argument types
     * @private
     */
    static getExample(comment) {
        const EXAMPLE = 'example';
        let result = '';
        let parsedComment = doctrine.parse(comment, {
            unwrap: true,
            sloppy: true,
            tags: [EXAMPLE]
        });

        const tags = parsedComment.tags;

        if (tags.length > 0) {
            result = tags[0].description;
        }

        return result;
    }
}

module.exports = JavaScriptParser;
