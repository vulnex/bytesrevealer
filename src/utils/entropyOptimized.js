/**
 * VULNEX -Bytes Revealer-
 *
 * File: entropyOptimized.js
 * Author: Simon Roses Femerling
 * Created: 2025-02-16
 * Version: 0.1
 * License: Apache-2.0
 * Copyright (c) 2025 VULNEX. All rights reserved.
 * https://www.vulnex.com
 */

import { createLogger } from './logger'

const logger = createLogger('EntropyOptimized')

/**
 * Calculate entropy for large files using sampling
 * @param {Uint8Array} fileBytes - The file data
 * @param {Object} options - Options for entropy calculation
 * @returns {Object} Entropy analysis results
 */
export function calculateOptimizedEntropy(fileBytes, options = {}) {
  const {
    blockSize = 256,        // Size of each block for entropy calculation
    maxBlocks = 1000,       // Maximum number of blocks to process
    sampleRate = 1.0        // Sampling rate (1.0 = all blocks, 0.5 = half)
  } = options

  const fileSize = fileBytes.length
  const totalBlocks = Math.ceil(fileSize / blockSize)

  // For large files, use sampling
  const isLargeFile = fileSize > 50 * 1024 * 1024 // 50MB
  const actualSampleRate = isLargeFile ? Math.min(sampleRate, maxBlocks / totalBlocks) : 1.0
  const blocksToProcess = Math.min(totalBlocks, Math.floor(totalBlocks * actualSampleRate))

  logger.debug(`Processing ${blocksToProcess} of ${totalBlocks} blocks (sample rate: ${actualSampleRate.toFixed(2)})`)

  const entropyValues = []
  const highEntropyRegions = []
  let globalFrequencies = new Array(256).fill(0)
  let processedBytes = 0

  // Calculate block stride for uniform sampling
  const blockStride = Math.max(1, Math.floor(totalBlocks / blocksToProcess))

  for (let blockIndex = 0; blockIndex < totalBlocks && entropyValues.length < maxBlocks; blockIndex += blockStride) {
    const start = blockIndex * blockSize
    const end = Math.min(start + blockSize, fileSize)
    const block = fileBytes.slice(start, end)

    if (block.length === 0) continue

    // Calculate entropy for this block
    const blockEntropy = calculateBlockEntropy(block)
    entropyValues.push({
      offset: start,
      entropy: blockEntropy,
      size: block.length
    })

    // Track high entropy regions (likely encrypted/compressed)
    if (blockEntropy > 7.5) {
      highEntropyRegions.push({
        start,
        end,
        entropy: blockEntropy
      })
    }

    // Update global frequency distribution
    for (const byte of block) {
      globalFrequencies[byte]++
    }

    processedBytes += block.length
  }

  // Calculate global entropy
  const globalEntropy = calculateEntropyFromFrequencies(globalFrequencies, processedBytes)

  // Merge adjacent high entropy regions
  const mergedRegions = mergeAdjacentRegions(highEntropyRegions, blockSize)

  return {
    globalEntropy,
    entropyValues,
    highEntropyRegions: mergedRegions,
    byteFrequencies: globalFrequencies,
    processedBytes,
    totalBytes: fileSize,
    blockSize,
    sampleRate: actualSampleRate,
    statistics: calculateStatistics(entropyValues)
  }
}

/**
 * Calculate entropy for a single block of data
 */
function calculateBlockEntropy(block) {
  const frequencies = new Array(256).fill(0)

  for (const byte of block) {
    frequencies[byte]++
  }

  return calculateEntropyFromFrequencies(frequencies, block.length)
}

/**
 * Calculate Shannon entropy from frequency distribution
 */
function calculateEntropyFromFrequencies(frequencies, totalBytes) {
  if (totalBytes === 0) return 0

  let entropy = 0

  for (let i = 0; i < 256; i++) {
    if (frequencies[i] > 0) {
      const probability = frequencies[i] / totalBytes
      entropy -= probability * Math.log2(probability)
    }
  }

  return entropy
}

/**
 * Merge adjacent high entropy regions
 */
function mergeAdjacentRegions(regions, blockSize) {
  if (regions.length === 0) return []

  const sorted = regions.sort((a, b) => a.start - b.start)
  const merged = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const previous = merged[merged.length - 1]

    // Merge if regions are adjacent or overlapping
    if (current.start <= previous.end + blockSize) {
      previous.end = Math.max(previous.end, current.end)
      previous.entropy = Math.max(previous.entropy, current.entropy)
    } else {
      merged.push(current)
    }
  }

  return merged
}

/**
 * Calculate statistics from entropy values
 */
function calculateStatistics(entropyValues) {
  if (entropyValues.length === 0) {
    return {
      min: 0,
      max: 0,
      average: 0,
      median: 0,
      standardDeviation: 0
    }
  }

  const entropies = entropyValues.map(v => v.entropy)
  const sorted = [...entropies].sort((a, b) => a - b)

  const min = Math.min(...entropies)
  const max = Math.max(...entropies)
  const average = entropies.reduce((sum, val) => sum + val, 0) / entropies.length

  // Calculate median
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]

  // Calculate standard deviation
  const variance = entropies.reduce((sum, val) => sum + Math.pow(val - average, 2), 0) / entropies.length
  const standardDeviation = Math.sqrt(variance)

  return {
    min,
    max,
    average,
    median,
    standardDeviation
  }
}

/**
 * Generate entropy visualization data
 */
export function generateEntropyVisualization(entropyData, width = 800, height = 200) {
  const { entropyValues } = entropyData

  if (!entropyValues || entropyValues.length === 0) {
    return null
  }

  // Create canvas-ready data points
  const points = []
  const xScale = width / entropyValues.length
  const yScale = height / 8 // Entropy ranges from 0-8

  entropyValues.forEach((value, index) => {
    points.push({
      x: index * xScale,
      y: height - (value.entropy * yScale),
      entropy: value.entropy,
      offset: value.offset
    })
  })

  return {
    points,
    width,
    height,
    highEntropyThreshold: height - (7.5 * yScale),
    lowEntropyThreshold: height - (2 * yScale)
  }
}