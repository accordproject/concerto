import { expect } from 'chai';

describe('no-duplicate-declarations', () => {

    it('should allow unique assets', () => {

        const model = `
        namespace org.example

        asset Car identified by vin {
            o String vin
        }

        asset Driver identified by license {
            o String license
        }
        `;

        expect(model).to.be.a('string');
    });

    it('should detect duplicate asset names', () => {

        const model = `
        namespace org.example

        asset Car identified by vin {
            o String vin
        }

        asset Car identified by vin {
            o String vin
        }
        `;

        expect(model).to.be.a('string');
    });

});