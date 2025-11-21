import React, { useMemo, useState } from 'react';
import { LogRule, ErrorSeverity } from '../types';

interface RuleSelectorProps {
  rules: LogRule[];
  selectedIds: Set<string>;
  onSelectionChange: (newSelection: Set<string>) => void;
}

const RuleSelector: React.FC<RuleSelectorProps> = ({ rules, selectedIds, onSelectionChange }) => {
  const [search, setSearch] = useState('');

  const filteredRules = useMemo(() => {
    return rules.filter(r => 
      r.name.toLowerCase().includes(search.toLowerCase()) || 
      r.regex.toLowerCase().includes(search.toLowerCase())
    );
  }, [rules, search]);

  const handleToggle = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    onSelectionChange(newSet);
  };

  const handleSelectAll = () => {
    if (filteredRules.length === 0) return;
    const newSet = new Set(selectedIds);
    filteredRules.forEach(r => newSet.add(r.id));
    onSelectionChange(newSet);
  };

  const handleDeselectAll = () => {
    if (filteredRules.length === 0) return;
    const newSet = new Set(selectedIds);
    filteredRules.forEach(r => newSet.delete(r.id));
    onSelectionChange(newSet);
  };

  const getSeverityColor = (sev: ErrorSeverity) => {
      if (sev === ErrorSeverity.CRITICAL) return 'bg-red-100 text-red-800 border-red-200';
      if (sev === ErrorSeverity.ERROR) return 'bg-orange-100 text-orange-800 border-orange-200';
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header / Search */}
      <div className="mb-3 space-y-2">
        <input 
          type="text"
          placeholder="搜索规则..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        <div className="flex gap-2 text-xs">
          <button onClick={handleSelectAll} className="text-indigo-600 hover:underline">全选当前</button>
          <span className="text-slate-300">|</span>
          <button onClick={handleDeselectAll} className="text-slate-500 hover:underline">取消当前</button>
          <span className="ml-auto text-slate-400">已选: {selectedIds.size}</span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto border border-slate-200 rounded-lg bg-slate-50 p-1 custom-scrollbar">
        {filteredRules.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">未找到规则</div>
        ) : (
          filteredRules.map(rule => (
            <div 
              key={rule.id}
              onClick={() => handleToggle(rule.id)}
              className={`
                flex items-start gap-3 p-2 rounded mb-1 cursor-pointer transition-colors select-none border
                ${selectedIds.has(rule.id) ? 'bg-white border-indigo-300 shadow-sm' : 'border-transparent hover:bg-slate-100'}
              `}
            >
              <div className={`w-4 h-4 mt-0.5 border rounded flex items-center justify-center flex-shrink-0 ${selectedIds.has(rule.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 bg-white'}`}>
                {selectedIds.has(rule.id) && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-1">
                    <span className={`text-sm font-medium truncate ${selectedIds.has(rule.id) ? 'text-indigo-900' : 'text-slate-700'}`}>{rule.name}</span>
                    <span className={`text-[10px] px-1.5 rounded border ${getSeverityColor(rule.severity)}`}>{rule.severity}</span>
                </div>
                <div className="text-[10px] font-mono text-slate-400 truncate" title={rule.regex}>{rule.regex}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RuleSelector;