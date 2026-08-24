import { Calendar } from "lucide-react";
import { Language, t } from "../utils/translate";

interface HeaderProps {
  lang: Language;
  setLang: (lang: Language) => void;
  currency: "THB" | "USD";
  onCurrencyChange: (currency: "THB" | "USD") => void;
}

export default function Header({ lang, setLang, currency, onCurrencyChange }: HeaderProps) {
  const now = new Date();
  const currentDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const getThaiBuddhistDate = () => {
    const today = new Date();
    const day = today.getDate();
    const christianYear = today.getFullYear();
    const buddhistYear = christianYear + 543;
    
    if (lang === "TH") {
      const thaiMonths = [
        "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
      ];
      const monthStr = thaiMonths[today.getMonth()];
      return `พ.ศ. ${buddhistYear} - ${day} ${monthStr}`;
    } else {
      const englishMonths = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const monthStr = englishMonths[today.getMonth()];
      return `${day} ${monthStr} ${buddhistYear} BE`;
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 py-4 px-6 mb-8 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3.5 flex-1">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 font-sans flex items-center gap-2">
              VT Garment <span className="text-blue-600 font-normal">{t("Sourcing Optimization Engine", lang)}</span>
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {t("Multi-Scenario Slicing, Container Optimization, Cumulative Rounding & MOQ Push-back Decision Support Dashboard", lang)}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col gap-1.5">
            {/* EN/TH Language Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setLang("EN")}
                className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  lang === "EN"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang("TH")}
                className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  lang === "TH"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                TH
              </button>
            </div>

            {/* THB/USD Currency Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => onCurrencyChange("THB")}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  currency === "THB"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                THB
              </button>
              <button
                onClick={() => onCurrencyChange("USD")}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                  currency === "USD"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                USD
              </button>
            </div>
          </div>

          <div className="flex flex-col items-start md:items-end">
            <div className="bg-slate-50 border border-slate-200 px-3 py-1 rounded-full text-slate-600 text-xs font-mono flex items-center gap-1.5">
              <Calendar size={13} className="text-blue-500" />
              <span>{t("Time", lang)}: {currentDateStr} UTC</span>
            </div>
            <div className="text-[10px] text-slate-500 font-sans font-medium px-2 mt-0.5">
              🇹🇭 {getThaiBuddhistDate()}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
