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



import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiThings from 'chai-things';
import * as NullUtil from '../src/null';

chai.use(chaiAsPromised);
chai.use(chaiThings);

describe('NullUtil', () => {
    describe('#isNull', () => {
        it('isNull null should be true', () => {
            expect(NullUtil.isNull(null)).to.be.true;
        });

        it('isNull undefined should be true', () => {
            expect(NullUtil.isNull(undefined)).to.be.true;
        });

        it('isNull "value" should be false', () => {
            expect(NullUtil.isNull('value')).to.be.false;
        });

        it('isNull 10 should be false', () => {
            expect(NullUtil.isNull(10)).to.be.false;
        });
    });
});