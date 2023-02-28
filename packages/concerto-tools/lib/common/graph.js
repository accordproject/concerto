/* eslint-disable require-jsdoc */
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

const fs = require('fs');
const { ModelUtil, ModelManager } = require('@accordproject/concerto-core');
const { FileWriter } = require('@accordproject/concerto-util');

const DiagramVisitor = require('./diagramvisitor');

/*
 * This class represents a directed graph using an
 * adjacency list representation.
 */
class DirectedGraph {

    /**
     * Construct a new graph from an adjacency map representation.
     *
     * Vertices are represented by strings.
     * Edges are a list of names of connected vertices
     *
     * @param {Object.<string, string[]>} adjacencyMap - initial graph
     */
    constructor(adjacencyMap = {}) {
        this.adjacencyMap = adjacencyMap;
    }

    /**
     * Adds an edge from `source` to `target`
     * @param {string} source - the origin of the edge
     * @param {*} target - the destination of the edge
     */
    addEdge(source, target) {
        this.adjacencyMap[source] ??= [];
        if (!this.adjacencyMap[source].includes(target)){
            this.adjacencyMap[source].push(target);
        }
    }

    /**
     * Checks if the graph has a named vertex
     * @param {string} vertex - the name of the new vertex
     * @return {boolean} - true, if the graph has the named vertex
     */
    hasVertex(vertex) {
        return !!this.adjacencyMap[vertex];
    }

    /**
     * Add a vertex to the graph
     * @param {string} vertex - the name of the new vertex
     */
    addVertex(vertex) {
        this.adjacencyMap[vertex] ??= [];
    }

    /**
     * A utility which traverses this directed graph from the `source` vertex
     * to visit all connected vertices to find the maximal subgraph.
     *
     * This is useful for finding disconnected subgraphs,
     * i.e. so-called "tree-shaking".
     *
     * Optionally supports a list of source vertices, to allow searching from
     * multiple start vertices.
     *
     * Returns a new DirectedGraph instance
     *
     * @param {string | string[]} source - The root vertex (or vertices) from
     * which to begin the search
     * @returns {DirectedGraph} - A maximal subgraph
     */
    findConnectedGraph(source) {
        // Normalize the source to an array, even if there's only one
        let sourceVertices = source;
        if (!Array.isArray(sourceVertices)){
            sourceVertices = [sourceVertices];
        }

        // Track our descent
        const visited = {};
        const queue = [...sourceVertices];

        // Initialize the state
        sourceVertices.forEach(v => { visited[v] = true; });

        // Perform a BFS search of the graph.
        let currentVertex;
        while (queue.length > 0) {
            currentVertex = queue[0];
            queue.shift();

            const edges = this.adjacencyMap[currentVertex] || [];

            edges.forEach(edge => {
                if (!visited[edge]) {
                    visited[edge] = true;
                    queue.push(edge);
                }
            });
        }

        return new DirectedGraph(Object.fromEntries(
            Object.entries(this.adjacencyMap)
                .filter(([vertex]) => visited[vertex])
        ));
    }

    /**
     * Visualizes the graph as a Mermaid Flowchart
     *
     * @param {Writer} writer - Buffer for text to be written
     */
    print(writer) {
        writer.writeLine(0, 'flowchart LR');
        Object.entries(this.adjacencyMap).forEach(([source, edges]) =>{
            writer.writeLine(1, `\`${source}\``);
            (edges || []).forEach(target => {
                writer.writeLine(1, `\`${source}\` --> \`${target}\``);
            });
        });
    }
}

/**
 * Convert the contents of a ModelManager to a directed graph where types are
 * vertices and edges are relationships between types.
 *
 * @private
 * @class
 * @memberof module:concerto-util
 */
class ConcertoGraphVisitor extends DiagramVisitor {
    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    visitClassDeclaration(classDeclaration, parameters) {
        parameters.stack ??= [];
        parameters.stack.push(classDeclaration.getFullyQualifiedName());
        parameters.graph.addVertex(classDeclaration.getFullyQualifiedName());
        super.visitClassDeclaration(classDeclaration, parameters);
        parameters.stack.pop();
    }

    /**
     * Visitor design pattern
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    visitField(field, parameters) {
        if (!ModelUtil.isPrimitiveType(field.getFullyQualifiedTypeName())) {
            parameters.graph.addEdge(parameters.stack.slice(-1), field.getFullyQualifiedTypeName());
        }
    }

    /**
     * Visitor design pattern
     * @param {Relationship} relationship - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    visitRelationship(relationship, parameters) {
        parameters.graph.addEdge(parameters.stack.slice(-1), relationship.getFullyQualifiedTypeName());
    }

    /**
     * Visitor design pattern
     * @param {EnumValueDeclaration} enumValueDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    visitEnumValueDeclaration(enumValueDeclaration, parameters) {
        return;
    }
}

module.exports = {
    ConcertoGraphVisitor,
    DirectedGraph
};

// const mm = new ModelManager();
// mm.addCTOModel(fs.readFileSync('./lib/common/stripe.cto', 'utf-8'));

// const graph = new DirectedGraph();
// mm.accept(new ConcertoGraphVisitor(), { graph });

// console.log('Number of concepts', mm.getConceptDeclarations().length);
// console.log('Number of models', mm.getModelFiles().length);

// console.log('##### Filtering #####');
// const connectedGraph = graph.findConnectedGraph('com.stripe.action.test@1.0.0.account');
// const filteredModelManager = mm.filter(decorated => connectedGraph.hasVertex(`${decorated.getNamespace()}.${decorated.getName()}`));

// console.log('Number of concepts', filteredModelManager.getConceptDeclarations().length);
// console.log('Number of models', filteredModelManager.getModelFiles().length);

// const writer = new FileWriter(__dirname);
// writer.openFile('graph.mmd');
// // graph.print(writer);
// connectedGraph.print(writer);
// writer.closeFile();
