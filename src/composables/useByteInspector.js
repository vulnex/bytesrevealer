import { ref } from 'vue'

/**
 * Composable for byte inspector hover/lock state and keyboard handler.
 */
export function useByteInspector() {
  const hoveredByte = ref(null)
  const inspectorLocked = ref(false)
  const lockedByte = ref(null)

  const handleKeyDown = (event) => {
    if (event.key.toLowerCase() === 'l') {
      if (!inspectorLocked.value && hoveredByte.value !== null) {
        inspectorLocked.value = true
        lockedByte.value = hoveredByte.value
      } else {
        inspectorLocked.value = false
        lockedByte.value = null
      }
    }
  }

  const onByteHover = (displayOffset, baseOffset) => {
    const actualOffset = displayOffset - baseOffset
    if (!inspectorLocked.value) {
      hoveredByte.value = actualOffset
    }
  }

  const onByteLeave = () => {
    hoveredByte.value = null
  }

  const lockInspector = (displayOffset, baseOffset) => {
    const actualOffset = displayOffset - baseOffset
    inspectorLocked.value = true
    lockedByte.value = actualOffset
  }

  return {
    hoveredByte,
    inspectorLocked,
    lockedByte,
    handleKeyDown,
    onByteHover,
    onByteLeave,
    lockInspector
  }
}
