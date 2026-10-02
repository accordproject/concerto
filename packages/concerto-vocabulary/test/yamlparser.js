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
const path = require('path');
const chai = require('chai');
chai.should();

const { validateVocabularyYaml } = require('../src/yamlparser');

const INVALID = path.join(__dirname, 'fixtures/invalid');
const VALID = path.join(__dirname, 'fixtures/valid');

/**
 * @param {string} dir fixture directory
 * @param {string} name fixture filename
 * @returns {string} file contents
 */
function loadFixture(dir, name) {
    return fs.readFileSync(path.join(dir, name), 'utf-8');
}

describe('validateVocabularyYaml', () => {

    describe('YAML syntax errors', () => {

        it('reports an error for an unclosed flow sequence', () => {
            const yaml = loadFixture(INVALID, 'syntax_unclosed_sequence.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.should.have.length.above(0);
            errors[0].path.should.equal('');
            errors[0].message.should.include('YAML');
        });

        it('reports an error for an unclosed flow mapping', () => {
            const yaml = loadFixture(INVALID, 'syntax_unclosed_mapping.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.should.have.length.above(0);
            errors[0].path.should.equal('');
            errors[0].message.should.include('YAML');
        });

        it('returns no syntax errors for well-formed YAML', () => {
            const yaml = loadFixture(VALID, 'org.acme@1.0.0_en.voc');
            const { errors } = validateVocabularyYaml(yaml);
            const syntaxErrors = errors.filter(e => e.message.includes('YAML'));
            syntaxErrors.should.have.lengthOf(0);
        });

    });

    describe('namespace field', () => {

        it('reports an error when namespace is missing', () => {
            const yaml = loadFixture(INVALID, 'namespace_missing.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.should.have.length.above(0);
            errors[0].path.should.equal('namespace');
        });

        it('reports an error when namespace is null', () => {
            const yaml = loadFixture(INVALID, 'namespace_null.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.should.have.length.above(0);
            errors[0].path.should.equal('namespace');
        });

        it('reports an error when namespace is an empty string', () => {
            const yaml = loadFixture(INVALID, 'namespace_empty_string.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.should.have.length.above(0);
            errors[0].path.should.equal('namespace');
        });

        it('reports an error when namespace is a boolean', () => {
            const yaml = loadFixture(INVALID, 'namespace_boolean.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.should.have.length.above(0);
            errors[0].path.should.equal('namespace');
        });

        it('reports an error when namespace is a number', () => {
            const yaml = loadFixture(INVALID, 'namespace_number.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.should.have.length.above(0);
            errors[0].path.should.equal('namespace');
        });

        it('reports an error when namespace is a sequence', () => {
            const yaml = loadFixture(INVALID, 'namespace_sequence.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.should.have.length.above(0);
            errors[0].path.should.equal('namespace');
        });

        it('reports an error when namespace is a mapping', () => {
            const yaml = loadFixture(INVALID, 'namespace_mapping.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.should.have.length.above(0);
            errors[0].path.should.equal('namespace');
        });

        it('accepts a valid namespace string', () => {
            const yaml = loadFixture(VALID, 'org.acme@1.0.0_en.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.filter(e => e.path === 'namespace').should.have.lengthOf(0);
        });

    });

    describe('locale field', () => {

        it('reports an error when locale is missing', () => {
            const yaml = loadFixture(INVALID, 'locale_missing.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'locale').should.be.true;
        });

        it('reports an error when locale is null', () => {
            const yaml = loadFixture(INVALID, 'locale_null.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'locale').should.be.true;
        });

        it('reports an error when locale uses underscore separator', () => {
            const yaml = loadFixture(INVALID, 'locale_underscore.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'locale').should.be.true;
        });

        it('reports an error when locale is not a valid BCP-47 tag', () => {
            const yaml = loadFixture(INVALID, 'locale_invalid_tag.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'locale').should.be.true;
        });

        it('accepts a valid lowercase locale', () => {
            const yaml = loadFixture(VALID, 'org.acme@1.0.0_en.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.filter(e => e.path === 'locale').should.have.lengthOf(0);
        });

        it('accepts a valid lowercase locale with region subtag', () => {
            const yaml = loadFixture(VALID, 'org.acme@1.0.0_en-gb.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.filter(e => e.path === 'locale').should.have.lengthOf(0);
        });

        it('accepts an uppercase locale', () => {
            const yaml = loadFixture(VALID, 'locale_uppercase.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.filter(e => e.path === 'locale').should.have.lengthOf(0);
        });

        it('accepts a mixed-case region subtag', () => {
            const yaml = loadFixture(VALID, 'locale_mixed_case_region.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.filter(e => e.path === 'locale').should.have.lengthOf(0);
        });

        it('accepts a Unicode extension tag (de-DE-u-co-phonebk)', () => {
            const yaml = loadFixture(VALID, 'locale_extension_tag.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.filter(e => e.path === 'locale').should.have.lengthOf(0);
        });

        it('accepts a three-level tag with script and region (zh-Hant-HK)', () => {
            const yaml = loadFixture(VALID, 'locale_script_region.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.filter(e => e.path === 'locale').should.have.lengthOf(0);
        });

        it('accepts a private-use tag (x-custom)', () => {
            const yaml = loadFixture(VALID, 'locale_private_use.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.filter(e => e.path === 'locale').should.have.lengthOf(0);
        });

    });

    describe('declarations field', () => {

        it('reports an error when declarations is missing', () => {
            const yaml = loadFixture(INVALID, 'declarations_missing.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations').should.be.true;
        });

        it('reports an error when declarations is null', () => {
            const yaml = loadFixture(INVALID, 'declarations_null.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations').should.be.true;
        });

        it('reports an error when declarations is a scalar', () => {
            const yaml = loadFixture(INVALID, 'declarations_scalar.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations').should.be.true;
        });

        // a mapping lacks the `-` dash prefix — `declarations:\n  Vehicle: ...` instead of `declarations:\n  - Vehicle: ...`
        it('reports an error when declarations is a mapping', () => {
            const yaml = loadFixture(INVALID, 'declarations_mapping.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations').should.be.true;
        });

        it('reports an error when declarations is flow style', () => {
            const yaml = loadFixture(INVALID, 'declarations_flow_style.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations').should.be.true;
        });

        it('accepts a valid declarations sequence', () => {
            const yaml = loadFixture(VALID, 'org.acme@1.0.0_en.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.filter(e => e.path === 'declarations').should.have.lengthOf(0);
        });

    });

    describe('namespace extended term values', () => {

        it('reports an error when an extended term value is a boolean', () => {
            const yaml = loadFixture(INVALID, 'namespace_extended_term_boolean.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'tooltip').should.be.true;
        });

        it('reports an error when an extended term value is a number', () => {
            const yaml = loadFixture(INVALID, 'namespace_extended_term_number.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'tooltip').should.be.true;
        });

        it('reports an error when an extended term value is null', () => {
            const yaml = loadFixture(INVALID, 'namespace_extended_term_null.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'tooltip').should.be.true;
        });

        it('reports an error when an extended term value is a sequence', () => {
            const yaml = loadFixture(INVALID, 'namespace_extended_term_sequence.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'tooltip').should.be.true;
        });

        it('reports an error when an extended term value is a mapping', () => {
            const yaml = loadFixture(INVALID, 'namespace_extended_term_mapping.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'tooltip').should.be.true;
        });

        it('accepts a valid vocabulary with no extended namespace terms', () => {
            const yaml = loadFixture(VALID, 'org.acme@1.0.0_en.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.filter(e => e.path === 'tooltip').should.have.lengthOf(0);
        });

    });

    describe('declaration entries', () => {

        it('reports an error when a declaration entry is a scalar', () => {
            const yaml = loadFixture(INVALID, 'declaration_entry_scalar.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0]').should.be.true;
        });

        it('reports an error when a declaration entry is a sequence', () => {
            const yaml = loadFixture(INVALID, 'declaration_entry_sequence.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0]').should.be.true;
        });

        it('reports an error when a declaration entry is an empty mapping', () => {
            const yaml = loadFixture(INVALID, 'declaration_entry_empty_mapping.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0]').should.be.true;
        });

        it('accepts declaration entries that are mappings', () => {
            const yaml = loadFixture(VALID, 'org.acme@1.0.0_en.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.filter(e => e.path.startsWith('declarations[')).should.have.lengthOf(0);
        });

    });

    describe('declaration primary term value', () => {

        it('reports an error when a declaration primary term is a boolean', () => {
            const yaml = loadFixture(INVALID, 'declaration_primary_term_boolean.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].Vehicle').should.be.true;
        });

        it('reports an error when a declaration primary term is a number', () => {
            const yaml = loadFixture(INVALID, 'declaration_primary_term_number.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].Vehicle').should.be.true;
        });

        it('reports an error when a declaration primary term is null', () => {
            const yaml = loadFixture(INVALID, 'declaration_primary_term_null.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].Vehicle').should.be.true;
        });

        it('reports an error when a declaration primary term is a sequence', () => {
            const yaml = loadFixture(INVALID, 'declaration_primary_term_sequence.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].Vehicle').should.be.true;
        });

        it('accepts a valid declaration primary term string', () => {
            const yaml = loadFixture(VALID, 'org.acme@1.0.0_en.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.filter(e => /^declarations\[\d+\]\.\w+$/.test(e.path)).should.have.lengthOf(0);
        });

    });

    describe('declaration non-structural values', () => {

        it('reports an error when a declaration non-structural value is a boolean', () => {
            const yaml = loadFixture(INVALID, 'declaration_non_structural_boolean.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].tooltip').should.be.true;
        });

        it('reports an error when a declaration non-structural value is a number', () => {
            const yaml = loadFixture(INVALID, 'declaration_non_structural_number.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].tooltip').should.be.true;
        });

        it('reports an error when a declaration non-structural value is null', () => {
            const yaml = loadFixture(INVALID, 'declaration_non_structural_null.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].tooltip').should.be.true;
        });

        it('reports an error when a declaration non-structural value is a sequence', () => {
            const yaml = loadFixture(INVALID, 'declaration_non_structural_sequence.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].tooltip').should.be.true;
        });

        it('reports an error when a declaration non-structural value is a mapping', () => {
            const yaml = loadFixture(INVALID, 'declaration_non_structural_mapping.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].tooltip').should.be.true;
        });

        it('accepts valid declaration non-structural string values', () => {
            const yaml = loadFixture(VALID, 'org.acme@1.0.0_en.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.filter(e => e.path === 'declarations[2].tooltip').should.have.lengthOf(0);
        });

    });

    describe('declaration properties field', () => {

        it('reports an error when properties is a scalar', () => {
            const yaml = loadFixture(INVALID, 'declaration_properties_scalar.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].properties').should.be.true;
        });

        it('reports an error when properties is a boolean', () => {
            const yaml = loadFixture(INVALID, 'declaration_properties_boolean.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].properties').should.be.true;
        });

        it('reports an error when properties is a mapping', () => {
            const yaml = loadFixture(INVALID, 'declaration_properties_mapping.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].properties').should.be.true;
        });

        it('reports an error when properties is flow style', () => {
            const yaml = loadFixture(INVALID, 'declaration_properties_flow_style.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].properties').should.be.true;
        });

        it('accepts a valid properties sequence', () => {
            const yaml = loadFixture(VALID, 'org.acme@1.0.0_en.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.filter(e => e.path === 'declarations[2].properties').should.have.lengthOf(0);
        });

    });

    describe('property entries', () => {

        it('reports an error when a property entry is a scalar', () => {
            const yaml = loadFixture(INVALID, 'property_entry_scalar.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].properties[0]').should.be.true;
        });

        it('reports an error when a property entry is a sequence', () => {
            const yaml = loadFixture(INVALID, 'property_entry_sequence.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].properties[0]').should.be.true;
        });

        it('reports an error when a property entry is an empty mapping', () => {
            const yaml = loadFixture(INVALID, 'property_entry_empty_mapping.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].properties[0]').should.be.true;
        });

        it('accepts property entries that are mappings', () => {
            const yaml = loadFixture(VALID, 'org.acme@1.0.0_en.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.filter(e => /^declarations\[\d+\]\.properties\[\d+\]$/.test(e.path)).should.have.lengthOf(0);
        });

    });

    describe('property term values', () => {

        it('reports an error when a property primary term is a boolean', () => {
            const yaml = loadFixture(INVALID, 'property_primary_term_boolean.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].properties[0].vin').should.be.true;
        });

        it('reports an error when a property primary term is null', () => {
            const yaml = loadFixture(INVALID, 'property_primary_term_null.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].properties[0].vin').should.be.true;
        });

        it('reports an error when a property non-structural value is a boolean', () => {
            const yaml = loadFixture(INVALID, 'property_non_structural_boolean.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].properties[0].tooltip').should.be.true;
        });

        it('reports an error when a property non-structural value is a sequence', () => {
            const yaml = loadFixture(INVALID, 'property_non_structural_sequence.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.some(e => e.path === 'declarations[0].properties[0].tooltip').should.be.true;
        });

        it('accepts valid property term string values', () => {
            const yaml = loadFixture(VALID, 'org.acme@1.0.0_en.voc');
            const { errors } = validateVocabularyYaml(yaml);
            errors.filter(e => /^declarations\[\d+\]\.properties\[\d+\]\.\w+$/.test(e.path)).should.have.lengthOf(0);
        });

    });

});
