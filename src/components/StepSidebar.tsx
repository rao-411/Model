import { Check, FileSpreadsheet, Sliders, BarChart3, ClipboardList } from "lucide-react";
import type { ReactNode } from "react";
import { Language, t } from "../utils/translate";

export interface StepDef {
  key: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
}

interface StepSidebarProps {
  hasData: boolean;
  activeStep: number; // 0-3, which section is currently in view / relevant
  hasWarnings: boolean;
  onStepClick: (stepIndex: number) => void;
  lang: Language;
}

export default function StepSidebar({ hasData, activeStep, hasWarnings, onStepClick, lang }: StepSidebarProps) {
  const steps: StepDef[] = [
    {
      key: "upload",
      icon: <FileSpreadsheet size={15} />,
      title: t("Upload manifest", lang),
      subtitle: t("Load your Syteline PR sheet", lang),
    },
    {
      key: "config",
      icon: <Sliders size={15} />,
      title: t("Set rates & quotes", lang),
      subtitle: t("Carrying rate, freight, MOQ, currency", lang),
    },
    {
      key: "compare",
      icon: <BarChart3 size={15} />,
      title: t("Compare scenarios", lang),
      subtitle: t("Cost of each shipping option", lang),
    },
    {
      key: "review",
      icon: <ClipboardList size={15} />,
      title: hasWarnings ? t("Review warnings & export", lang) : t("Review & export", lang),
      subtitle: hasWarnings ? t("Fix flags, get the requisition", lang) : t("Get the requisition & line output", lang),
    },
  ];

  return (
    <nav className="hidden lg:flex flex-col w-64 shrink-0 sticky top-6 self-start h-[calc(100vh-5.5rem)]">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm py-4 flex flex-col h-full">
        <div className="px-4 pb-3 mb-1 border-b border-slate-100">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {t("Where you are", lang)}
          </span>
        </div>
        <ol className="flex-1 space-y-1">
          {steps.map((step, idx) => {
            const isDone = hasData && idx < activeStep;
            const isActive = hasData ? idx === activeStep : idx === 0;
            const isClickable = idx === 0 || hasData;
            return (
              <li key={step.key}>
                <button
                  onClick={() => isClickable && onStepClick(idx)}
                  disabled={!isClickable}
                  className={`w-full flex items-start gap-2.5 text-left px-4 py-2.5 border-l-2 transition-colors ${
                    isActive
                      ? "border-blue-600 bg-blue-50/60"
                      : "border-transparent hover:bg-slate-50"
                  } ${isClickable ? "cursor-pointer" : "cursor-default opacity-60"}`}
                >
                  <span
                    className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono border ${
                      isDone
                        ? "bg-blue-600 border-blue-600 text-white"
                        : isActive
                        ? "border-blue-600 text-blue-600"
                        : "border-slate-300 text-slate-400"
                    }`}
                  >
                    {isDone ? <Check size={11} /> : idx + 1}
                  </span>
                  <span>
                    <div
                      className={`text-xs font-semibold leading-tight ${
                        isActive ? "text-blue-700" : isDone ? "text-slate-700" : "text-slate-500"
                      }`}
                    >
                      {step.title}
                      {step.key === "review" && hasWarnings && (
                        <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-500 align-middle" />
                      )}
                    </div>
                    <div className="text-[10.5px] text-slate-400 leading-snug mt-0.5">
                      {step.subtitle}
                    </div>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
