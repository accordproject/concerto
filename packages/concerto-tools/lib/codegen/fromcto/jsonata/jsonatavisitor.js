/* eslint-disable */

const { loremIpsum } = require('lorem-ipsum');

class JsonataVisitor {
    visit(thing, parameters) {
        if (thing.isModelManager?.()) {
            return this.visitModelManager(thing, parameters);
        } else if (thing.isModelFile?.()) {
            return this.visitModelFile(thing, parameters);
        } else if (thing.isClassDeclaration?.()) {
            return this.visitClassDeclaration(thing, parameters);
        } else if (thing.isField?.()) {
            return this.visitField(thing, parameters);
        } else if (thing.isRelationship?.()) {
            return this.visitRelationshipDeclaration(thing, parameters);
        } else {
            throw new Error(`Unsupported thing "${thing.constructor.name}"`);
        }
    }

    visitModelManager(thing, parameters) {
        const rootType = thing.getType(parameters.rootType);
        rootType.accept(this, parameters);
    }

    visitModelFile(thing, parameters) {
        const rootType = thing.getType(parameters.rootType);
        rootType.accept(this, parameters);
    }

    visitClassDeclaration(thing, parameters) {
        const { fileWriter, indent = 0, sample = false } = parameters;
        const isRootFile = !fileWriter.isFileOpen();
        if (isRootFile) {
            fileWriter.openFile(`${thing.getFullyQualifiedName()}.jsonata`);
            fileWriter.writeLine(indent, '{');
        } else {
            fileWriter.write('{\n');
        }
        const properties = thing.getProperties();
        fileWriter.writeIndented(indent + 1, `"$class": "${thing.getFullyQualifiedName()}"`);
        if (properties.length > 0) {
            fileWriter.write(',\n');
        } else {
            fileWriter.write('\n');
        }
        for (const [i, property] of properties.entries()) {
            property.accept(this, { ...parameters, indent: indent + 1 });
            if (i < (properties.length - 1)) {
                fileWriter.write(',\n');
            } else {
                fileWriter.write('\n');
            }
        }
        if (isRootFile) {
            fileWriter.writeLine(indent, '}');
            fileWriter.closeFile();
        } else {
            fileWriter.writeIndented(indent, '}');
        }
    }

    visitField(thing, parameters) {
        const { fileWriter, indent = 0, sample } = parameters;
        if (thing.isOptional()) {
            fileWriter.writeIndented(indent, `"${thing.getName()}": undefined`);
        } else if (thing.isArray() && sample) {
            fileWriter.writeIndented(indent, `"${thing.getName()}": [\n`);
            if (thing.isPrimitive()) {
                const value = this.getSamplePrimitiveValue(thing.getType());
                fileWriter.writeLine(indent + 1, value);
            } else if (thing.isTypeEnum()) {
                const type = thing.getModelFile().getType(thing.getType());
                const value = this.getSampleEnumValue(type);
                fileWriter.writeLine(indent + 1, value);
            } else {
                const type = thing.getModelFile().getType(thing.getType());
                type.accept(this, { ...parameters });
            }
            fileWriter.writeIndented(indent, ']');
        } else if (thing.isArray()) {
            fileWriter.writeIndented(indent, `"${thing.getName()}": []`);
        } else if (thing.isPrimitive()) {
            const value = this.getPrimitiveValue(thing.getType(), parameters);
            fileWriter.writeIndented(indent, `"${thing.getName()}": ${value}`);
        } else if (thing.isTypeEnum()) {
            const type = thing.getModelFile().getType(thing.getType());
            const value = this.getEnumValue(type, parameters);
            fileWriter.writeIndented(indent, `"${thing.getName()}": ${value}`);
        } else {
            const type = thing.getModelFile().getType(thing.getType());
            fileWriter.writeIndented(indent, `"${thing.getName()}": `);
            type.accept(this, { ...parameters });
        }
    }

    visitRelationshipDeclaration(thing, parameters) {
        const { fileWriter, indent = 0 } = parameters;
        if (thing.isOptional()) {
            fileWriter.writeIndented(indent, `"${thing.getName()}": undefined`);
        } else if (thing.isArray()) {
            fileWriter.writeIndented(indent, `"${thing.getName()}": []`);
        } else {
            const defaultValue = this.getPrimitiveValue(thing.getFullyQualifiedTypeName(), parameters);
            fileWriter.writeIndented(indent, `"${thing.getName()}": ${defaultValue}`);
        }
    }

    getPrimitiveValue(type, parameters) {
        const { sample = false } = parameters;
        if (sample) {
            return this.getSamplePrimitiveValue(type);
        } else {
            return this.getDefaultPrimitiveValue(type);
        }
    }

    getDefaultPrimitiveValue(type) {
        return `$todo("${type}")`;
    }

    getSamplePrimitiveValue(type) {
        switch (type) {
            case 'String':
                return `"${loremIpsum({ count: 5, units: 'words' }).toLowerCase()}"`;
            case 'DateTime':
                return '$now()'
            case 'Boolean':
                return true;
            case 'Integer':
            case 'Long':
                return '$round($random() * 100)';
            case 'Double':
                return '$round($random() * 100, 2)';
            default:
                throw new Error(`Unsupported type "${type}"`);
        }
    }

    getEnumValue(type, parameters) {
        const { sample = false } = parameters;
        if (sample) {
            return this.getSampleEnumValue(type);
        } else {
            return this.getDefaultEnumValue(type);
        }
    }

    getDefaultEnumValue(type) {
        return `$todo("${type.getFullyQualifiedName()}")`;
    }

    getSampleEnumValue(type) {
        const enumValues = type.getProperties();
        if (enumValues.length === 0) {
            throw new Error(`No enumerated values in enumeration "${type.getFullyQualifiedName()}"`)
        }
        const enumValue = enumValues[Math.floor(enumValues.length * Math.random())];
        return `"${enumValue.getName()}"`;
    }
}

module.exports = JsonataVisitor;
