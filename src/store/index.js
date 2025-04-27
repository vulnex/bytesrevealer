/** 
 * VULNEX -Bytes Revealer-
 *
 * File: index.js
 * Author: Simon Roses Femerling
 * Created: 2025-04-27
 * Last Modified: 2025-04-27
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import { createStore } from 'vuex'
import settings from './modules/settings'

const store = createStore({
  modules: {
    settings
  }
})

export default store 