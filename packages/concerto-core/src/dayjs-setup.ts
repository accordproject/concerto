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

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const quarterOfYear = require('dayjs/plugin/quarterOfYear');
const minMax = require('dayjs/plugin/minMax');
const duration = require('dayjs/plugin/duration');

dayjs.extend(utc);
dayjs.extend(quarterOfYear);
dayjs.extend(minMax);
dayjs.extend(duration);

export = dayjs;
