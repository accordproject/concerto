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

const MermaidVisitor = require('../mermaid/mermaidvisitor');
const InMemoryWriter = require('@accordproject/concerto-util').InMemoryWriter;

/**
 * Convert the contents of a ModelManager
 * to markdown file, containing Mermaid files for the diagrams.
 * Set a fileWriter property (instance of FileWriter) on the parameters
 * object to control where the generated code is written to disk.
 *
 * @private
 * @class
 */
class MarkdownVisitor {
    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visit(thing, parameters) {
        if (thing.isModelManager?.()) {
            return this.visitModelManager(thing, parameters);
        } else if (thing.isModelFile?.()) {
            return this.visitModelFile(thing, parameters);
        }
        else {
            throw new Error('Unrecognised ' + JSON.stringify(thing));
        }
    }

    /**
     * Visitor design pattern
     * @param {ModelManager} modelManager - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitModelManager(modelManager, parameters) {
        parameters.fileWriter.openFile('models.md');

        modelManager.getModelFiles().forEach((decl) => {
            decl.accept(this, parameters);
        });

        parameters.fileWriter.closeFile();

        return null;
    }

    /**
     * Visitor design pattern
     * @param {ModelFile} modelFile - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitModelFile(modelFile, parameters) {
        parameters.fileWriter.writeLine(0, `# Namespace ${modelFile.getNamespace()}`);

        parameters.fileWriter.writeLine(0, '');
        parameters.fileWriter.writeLine(0, '## Overview');
        parameters.fileWriter.writeLine(0, `- ${modelFile.getConceptDeclarations().length} concepts`);
        parameters.fileWriter.writeLine(0, `- ${modelFile.getEnumDeclarations().length} enumerations`);
        parameters.fileWriter.writeLine(0, `- ${modelFile.getAssetDeclarations().length} assets`);
        parameters.fileWriter.writeLine(0, `- ${modelFile.getParticipantDeclarations().length} participants`);
        parameters.fileWriter.writeLine(0, `- ${modelFile.getTransactionDeclarations().length} transactions`);
        parameters.fileWriter.writeLine(0, `- ${modelFile.getEventDeclarations().length} events`);
        parameters.fileWriter.writeLine(0, `- ${modelFile.getAllDeclarations().length} total declarations`);

        parameters.fileWriter.writeLine(0, '');
        parameters.fileWriter.writeLine(0, '## Imports');
        modelFile.getImports().forEach( imp => {
            parameters.fileWriter.writeLine(0, `- ${imp}`);
        });

        const visitor = new MermaidVisitor();
        const writer = new InMemoryWriter();
        writer.openFile('model.mmd');
        writer.writeLine(0, '```mermaid');
        writer.writeLine(0, 'classDiagram');

        const childParameters = {
            fileWriter: writer,
            hideBaseModel: true,
            showCompositionRelationships: true
        };
        modelFile.accept(visitor, childParameters);
        writer.writeLine(0, '```');
        writer.closeFile();

        const files = writer.getFilesInMemory();

        const diagram = files.get('model.mmd');

        if (diagram) {
            parameters.fileWriter.writeLine(0, '');
            parameters.fileWriter.writeLine(0, '## Diagram');
            parameters.fileWriter.writeLine(0, diagram);
        }

        return null;
    }
}

module.exports = MarkdownVisitor;