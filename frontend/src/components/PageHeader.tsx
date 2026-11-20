import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string;
}

export function PageHeader({ title, subtitle, backTo = '/' }: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="mb-6 pb-4 border-b border-[#dce5df]">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#176b4b] hover:bg-[#e8f0eb] transition cursor-pointer"
          aria-label="Kembali"
        >
          <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#17251f] tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-[#506457] mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
