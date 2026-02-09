/**
 * VULNEX -Bytes Revealer-
 *
 * File: BookmarksPanel.vue
 * Author: Simon Roses Femerling
 * Created: 2026-02-09
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025-2026 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

<template>
  <div class="bookmarks-panel">
    <!-- Filter & Sort Controls -->
    <div class="panel-controls">
      <input
        type="text"
        v-model="filterText"
        placeholder="Filter by label..."
        class="filter-input"
      />
      <select v-model="sortBy" class="sort-select">
        <option value="offset">Sort by Offset</option>
        <option value="name">Sort by Name</option>
        <option value="date">Sort by Date</option>
      </select>
    </div>

    <!-- Bookmarks Section -->
    <div class="section">
      <div class="section-header" @click="showBookmarks = !showBookmarks">
        <span class="collapse-icon">{{ showBookmarks ? '▼' : '▶' }}</span>
        <span class="section-title">Bookmarks ({{ filteredBookmarks.length }})</span>
      </div>
      <div v-if="showBookmarks" class="section-content">
        <div v-if="filteredBookmarks.length === 0" class="empty-message">
          No bookmarks yet. Right-click a byte in Hex View to add one.
        </div>
        <div
          v-for="bookmark in filteredBookmarks"
          :key="bookmark.id"
          class="item bookmark-item"
          @click="$emit('navigate-to-offset', bookmark.offset)"
        >
          <span class="color-dot" :style="{ backgroundColor: bookmark.color }"></span>
          <div class="item-info">
            <span class="item-label">{{ bookmark.label }}</span>
            <span class="item-offset">0x{{ bookmark.offset.toString(16).toUpperCase().padStart(8, '0') }}</span>
          </div>
          <div class="item-actions">
            <button class="action-btn" @click.stop="startEdit('bookmark', bookmark)" title="Edit">&#9998;</button>
            <button class="action-btn delete-btn" @click.stop="$emit('remove-bookmark', bookmark.id)" title="Delete">&#10005;</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Annotations Section -->
    <div class="section">
      <div class="section-header" @click="showAnnotations = !showAnnotations">
        <span class="collapse-icon">{{ showAnnotations ? '▼' : '▶' }}</span>
        <span class="section-title">Annotations ({{ filteredAnnotations.length }})</span>
      </div>
      <div v-if="showAnnotations" class="section-content">
        <div v-if="filteredAnnotations.length === 0" class="empty-message">
          No annotations yet. Select a byte range in Hex View, then right-click to annotate.
        </div>
        <div
          v-for="annotation in filteredAnnotations"
          :key="annotation.id"
          class="item annotation-item"
          @click="$emit('navigate-to-offset', annotation.startOffset)"
        >
          <span class="color-bar" :style="{ backgroundColor: annotation.color }"></span>
          <div class="item-info">
            <span class="item-label">{{ annotation.label }}</span>
            <span class="item-offset">
              0x{{ annotation.startOffset.toString(16).toUpperCase().padStart(8, '0') }}
              - 0x{{ annotation.endOffset.toString(16).toUpperCase().padStart(8, '0') }}
            </span>
            <span
              v-if="annotation.note"
              class="item-note"
              :class="{ expanded: expandedNotes[annotation.id] }"
              @click.stop="toggleNote(annotation.id)"
            >{{ annotation.note }}</span>
          </div>
          <div class="item-actions">
            <button class="action-btn" @click.stop="startEdit('annotation', annotation)" title="Edit">&#9998;</button>
            <button class="action-btn delete-btn" @click.stop="$emit('remove-annotation', annotation.id)" title="Delete">&#10005;</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Inline Edit Dialog -->
    <div v-if="editItem" class="edit-overlay" @click.self="cancelEdit">
      <div class="edit-dialog">
        <div class="edit-header">
          <span>Edit {{ editType === 'bookmark' ? 'Bookmark' : 'Annotation' }}</span>
          <button class="close-btn" @click="cancelEdit">&#10005;</button>
        </div>
        <div class="edit-body">
          <label class="edit-label">Label</label>
          <input
            type="text"
            v-model="editForm.label"
            class="edit-input"
            @keyup.enter="saveEdit"
          />
          <template v-if="editType === 'annotation'">
            <label class="edit-label">Note</label>
            <textarea
              v-model="editForm.note"
              class="edit-textarea"
              rows="3"
              placeholder="Add a note..."
            ></textarea>
          </template>
          <label class="edit-label">Color</label>
          <div class="color-picker">
            <div
              v-for="color in paletteColors"
              :key="color"
              class="color-swatch"
              :class="{ selected: editForm.color === color }"
              :style="{ backgroundColor: color }"
              @click="editForm.color = color"
            ></div>
          </div>
        </div>
        <div class="edit-footer">
          <button class="btn btn-cancel" @click="cancelEdit">Cancel</button>
          <button class="btn btn-save" @click="saveEdit">Save</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'BookmarksPanel',
  props: {
    bookmarks: {
      type: Array,
      default: () => []
    },
    annotations: {
      type: Array,
      default: () => []
    }
  },
  emits: [
    'navigate-to-offset',
    'update-bookmark',
    'remove-bookmark',
    'update-annotation',
    'remove-annotation'
  ],
  data() {
    return {
      filterText: '',
      sortBy: 'offset',
      showBookmarks: true,
      showAnnotations: true,
      expandedNotes: {},
      editItem: null,
      editType: null,
      editForm: {
        label: '',
        note: '',
        color: '#4fc3f7'
      },
      paletteColors: [
        '#4fc3f7', '#81c784', '#ffb74d', '#e57373',
        '#ba68c8', '#4db6ac', '#fff176', '#f06292'
      ]
    }
  },
  computed: {
    filteredBookmarks() {
      let items = [...this.bookmarks]
      if (this.filterText) {
        const query = this.filterText.toLowerCase()
        items = items.filter(b => b.label.toLowerCase().includes(query))
      }
      return this.sortItems(items, 'bookmark')
    },
    filteredAnnotations() {
      let items = [...this.annotations]
      if (this.filterText) {
        const query = this.filterText.toLowerCase()
        items = items.filter(a =>
          a.label.toLowerCase().includes(query) ||
          (a.note && a.note.toLowerCase().includes(query))
        )
      }
      return this.sortItems(items, 'annotation')
    }
  },
  methods: {
    sortItems(items, type) {
      const offsetKey = type === 'bookmark' ? 'offset' : 'startOffset'
      switch (this.sortBy) {
        case 'name':
          return items.sort((a, b) => a.label.localeCompare(b.label))
        case 'date':
          return items.sort((a, b) => new Date(b.created) - new Date(a.created))
        case 'offset':
        default:
          return items.sort((a, b) => a[offsetKey] - b[offsetKey])
      }
    },
    toggleNote(id) {
      this.expandedNotes = {
        ...this.expandedNotes,
        [id]: !this.expandedNotes[id]
      }
    },
    startEdit(type, item) {
      this.editType = type
      this.editItem = item
      this.editForm = {
        label: item.label,
        note: item.note || '',
        color: item.color
      }
    },
    cancelEdit() {
      this.editItem = null
      this.editType = null
    },
    saveEdit() {
      if (!this.editItem) return
      const updated = {
        ...this.editItem,
        label: this.editForm.label,
        color: this.editForm.color
      }
      if (this.editType === 'annotation') {
        updated.note = this.editForm.note
        this.$emit('update-annotation', updated)
      } else {
        this.$emit('update-bookmark', updated)
      }
      this.cancelEdit()
    }
  }
}
</script>

<style scoped>
.bookmarks-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  font-size: 13px;
}

.panel-controls {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid var(--border-color);
}

.filter-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
}

.sort-select {
  padding: 4px 6px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 12px;
}

.section {
  border-bottom: 1px solid var(--border-color);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  cursor: pointer;
  font-weight: 600;
  user-select: none;
}

.section-header:hover {
  background: var(--hover-bg);
}

.collapse-icon {
  font-size: 10px;
  width: 12px;
}

.section-content {
  padding: 4px 0;
}

.empty-message {
  padding: 12px 16px;
  color: var(--text-secondary);
  font-style: italic;
  font-size: 12px;
}

.item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.item:hover {
  background: var(--hover-bg);
}

.color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.color-bar {
  width: 4px;
  height: 28px;
  border-radius: 2px;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-label {
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-offset {
  font-family: monospace;
  font-size: 11px;
  color: var(--text-secondary);
}

.item-note {
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-height: 1.4em;
  cursor: pointer;
}

.item-note.expanded {
  white-space: normal;
  max-height: none;
}

.item-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.item:hover .item-actions {
  opacity: 1;
}

.action-btn {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  cursor: pointer;
  padding: 2px 6px;
  font-size: 12px;
  color: var(--text-primary);
  line-height: 1;
}

.action-btn:hover {
  background: var(--hover-bg);
}

.action-btn.delete-btn:hover {
  background: #e5393533;
  color: #e53935;
  border-color: #e53935;
}

/* Edit Dialog */
.edit-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.edit-dialog {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  width: 280px;
  max-width: 90%;
}

.edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-color);
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-secondary);
  padding: 2px 6px;
}

.close-btn:hover {
  color: var(--text-primary);
}

.edit-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.edit-input,
.edit-textarea {
  padding: 6px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
}

.color-picker {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.15s, transform 0.15s;
}

.color-swatch:hover {
  transform: scale(1.15);
}

.color-swatch.selected {
  border-color: var(--text-primary);
}

.edit-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--border-color);
}

.btn {
  padding: 5px 14px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid var(--border-color);
}

.btn-cancel {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.btn-cancel:hover {
  background: var(--hover-bg);
}

.btn-save {
  background: #4fc3f7;
  color: #fff;
  border-color: #4fc3f7;
}

.btn-save:hover {
  background: #29b6f6;
  border-color: #29b6f6;
}

/* Dark mode */
.dark-mode .edit-overlay {
  background: rgba(0, 0, 0, 0.6);
}

.dark-mode .edit-dialog {
  background: #2a2a2a;
  border-color: #444;
}

.dark-mode .filter-input,
.dark-mode .sort-select,
.dark-mode .edit-input,
.dark-mode .edit-textarea {
  background: #1e1e1e;
  border-color: #444;
  color: #e0e0e0;
}
</style>
