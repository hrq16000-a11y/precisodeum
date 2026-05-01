import { Loader2 } from 'lucide-react';

const SuspenseFallback = () => (
  <div className="flex justify-center p-8">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

export default SuspenseFallback;
