import * as fs from 'fs/promises';
import * as path from 'path';
import { Parser } from '@accordproject/concerto-cto';
import { Json as JsonParsers } from '@stoplight/spectral-parsers';
import { Spectral, Document, IRuleResult, RulesetDefinition } from '@stoplight/spectral-core';

/**
 * Tests the Concerto linter's default ruleset.
 * @param {RulesetDefinition} [ruleset] - Optional ruleset to apply for testing.
 * @param {string} modelFile - The model (CTO string) to be linted.
 Note: No external dependency resolution is performed.
 * @returns {Promise<IRuleResult[]>} A promise that resolves to an array of linting results.
 * @throws {Error} If a critical processing failure occurs during linting.
 */
export async function testRules(ruleset: RulesetDefinition, modelFile: string): Promise<IRuleResult[]> {
    try {
        const filePath = path.resolve(__dirname, './fixtures/', modelFile);
        const model = await fs.readFile(filePath, 'utf-8');

        const jsonAST = JSON.stringify(Parser.parseModels([model]));

        const spectral = new Spectral();
        spectral.setRuleset(ruleset);

        const document = new Document(jsonAST, JsonParsers);
        return await spectral.run(document);
    } catch (error) {
        throw new Error(`Failed to test the default-ruleset: ${error instanceof Error ? error.message : String(error)}`);
    }
}