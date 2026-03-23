import { Checkbox } from '@/components/ui/checkbox';

interface SelectionCheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

const SelectionCheckbox = ({ checked, onCheckedChange, className }: SelectionCheckboxProps) => (
  <Checkbox
    checked={checked}
    onCheckedChange={onCheckedChange}
    className={className}
  />
);

export default SelectionCheckbox;
