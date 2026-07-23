import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { act, render, screen, fireEvent } from '@testing-library/react'
import { SaveButton } from './SaveButton'

/** Mirrors a calculator page: `dirty` is owned by the parent and flips clean after a good save. */
function Harness({ onSave }: { onSave: () => Promise<boolean> }) {
  const [dirty, setDirty] = useState(true)
  return (
    <SaveButton
      dirty={dirty}
      onSave={async () => {
        const ok = await onSave()
        if (ok) setDirty(false)
        return ok
      }}
    />
  )
}

describe('SaveButton', () => {
  it('is disabled when the form is clean', () => {
    render(<SaveButton dirty={false} onSave={async () => true} />)
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByRole('button')).toHaveTextContent('Save')
  })

  it('is an enabled "Save" when dirty', () => {
    render(<SaveButton dirty onSave={async () => true} />)
    const button = screen.getByRole('button')
    expect(button).toBeEnabled()
    expect(button).toHaveTextContent('Save')
  })

  it('idle → saving → saved on a successful persist', async () => {
    let resolve!: (ok: boolean) => void
    const onSave = vi.fn(() => new Promise<boolean>((r) => { resolve = r }))
    render(<Harness onSave={onSave} />)

    fireEvent.click(screen.getByRole('button'))
    // In-flight: "Saving", disabled.
    expect(screen.getByRole('button')).toHaveTextContent('Saving')
    expect(screen.getByRole('button')).toBeDisabled()

    await act(async () => { resolve(true) })

    // Landed: "Saved", still disabled (form is now clean).
    expect(screen.getByRole('button')).toHaveTextContent('Saved')
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('a FAILED persist never reaches "Saved" — it returns to an enabled "Save"', async () => {
    const onSave = vi.fn(async () => false)
    render(<Harness onSave={onSave} />)

    fireEvent.click(screen.getByRole('button'))
    await act(async () => {})

    const button = screen.getByRole('button')
    expect(button).toHaveTextContent('Save')
    expect(button).not.toHaveTextContent('Saved')
    // The form is still dirty (parent never marked it clean), so Save stays available for a retry.
    expect(button).toBeEnabled()
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('a thrown persist is treated as not-saved (no "Saved")', async () => {
    const onSave = vi.fn(async () => { throw new Error('network') })
    render(<Harness onSave={onSave} />)

    fireEvent.click(screen.getByRole('button'))
    await act(async () => {})

    expect(screen.getByRole('button')).not.toHaveTextContent('Saved')
    expect(screen.getByRole('button')).toHaveTextContent('Save')
  })

  it('re-dirtying after a save clears the "Saved" tick', async () => {
    function ReDirtyHarness() {
      const [dirty, setDirty] = useState(true)
      return (
        <>
          <SaveButton
            dirty={dirty}
            onSave={async () => { setDirty(false); return true }}
          />
          <button onClick={() => setDirty(true)}>edit</button>
        </>
      )
    }
    render(<ReDirtyHarness />)
    const [saveBtn] = screen.getAllByRole('button')

    fireEvent.click(saveBtn)
    await act(async () => {})
    expect(screen.getAllByRole('button')[0]).toHaveTextContent('Saved')

    // Simulate the user editing again.
    fireEvent.click(screen.getByRole('button', { name: 'edit' }))
    expect(screen.getAllByRole('button')[0]).toHaveTextContent('Save')
    expect(screen.getAllByRole('button')[0]).not.toHaveTextContent('Saved')
  })
})
