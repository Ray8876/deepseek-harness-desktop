export interface SegmentedControlOption {
  value: string
  label: string
  disabled?: boolean
  title?: string
}

export interface SegmentedControlProps {
  id?: string
  label?: string
  value: string
  disabled?: boolean
  options: readonly SegmentedControlOption[]
  onChange: (next: string) => void
}
