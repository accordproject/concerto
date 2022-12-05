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

const metaModelCtoPath = path.resolve(__dirname, 'lib', 'metamodel.cto');
const metaModelCto = fs.readFileSync(metaModelCtoPath, 'utf-8');
const metaModelJs = `/*
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

/* eslint-disable */

'use strict';

/**
 * The metamodel itself, as a CTO string
 */
const metaModelCto = ${JSON.stringify(metaModelCto)};

module.exports = metaModelCto;
`;
const metaModelJsPath = path.resolve(__dirname, 'lib', 'metamodel.js');
fs.writeFileSync(metaModelJsPath, metaModelJs, 'utf-8');
