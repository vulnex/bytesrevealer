/** 
 * VULNEX -Bytes Revealer-
 *
 * File: settings.js
 * Author: Simon Roses Femerling
 * Created: 2025-04-27
 * Last Modified: 2025-04-27
 * Version: 0.2
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

export default {
  namespaced: true,
  state: () => ({
    baseOffset: 0
  }),
  mutations: {
    SET_BASE_OFFSET(state, offset) {
      state.baseOffset = offset
    }
  },
  actions: {
    updateBaseOffset({ commit }, offset) {
      commit('SET_BASE_OFFSET', offset)
    }
  },
  getters: {
    baseOffset: state => state.baseOffset
  }
} 