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

// The introspect modules the views build, each required on first use (they
// import the views back, through the engine loader) and kept. A leaf: it
// imports no other views module, so every one of them can import it.

// Introspect modules, required on first use (they import this module's
// callers) and cached.
let numberValidatorCache: any;

let stringValidatorCache: any;

let collectionSizeValidatorCache: any;

let fieldCache: any;

function numberValidatorModule(): any {
    return numberValidatorCache ?? (numberValidatorCache = require('../introspect/numbervalidator'));
}

function stringValidatorModule(): any {
    return stringValidatorCache ?? (stringValidatorCache = require('../introspect/stringvalidator'));
}

function collectionSizeValidatorModule(): any {
    return collectionSizeValidatorCache ?? (collectionSizeValidatorCache = require('../introspect/collectionsizevalidator'));
}

function fieldModule(): any {
    return fieldCache ?? (fieldCache = require('../introspect/field'));
}

let modelFileCache: any;

function modelFileModule(): any {
    return modelFileCache ?? (modelFileCache = require('../introspect/modelfile'));
}

let decoratorCache: any;

/** The introspect/decorator module, required once. */
function decoratorModule(): any {
    return decoratorCache ?? (decoratorCache = require('../introspect/decorator'));
}

export {
    collectionSizeValidatorModule,
    decoratorModule,
    fieldModule,
    modelFileModule,
    numberValidatorModule,
    stringValidatorModule,
};
