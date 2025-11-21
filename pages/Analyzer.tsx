import React, { useState, useMemo, useEffect } from 'react';
import FileUpload from '../components/FileUpload';
import RuleSelector from '../components/RuleSelector';
import { analyzeLog, getRules } from '../services/analysisEngine';
import { AnalysisReport, AnalyzedIssue, ErrorSeverity, LogRule } from '../types';
import ReactMarkdown from 'react-markdown';

type SortOrder = 'severity_desc' | 'count_desc' | 'name_asc';

interface IssueGroup {
  ruleId: string;
  ruleName: string;
  severity: ErrorSeverity;
  issues: AnalyzedIssue[];
}

const Analyzer: React.FC = () => {
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Rule Configuration State
  const [allRules, setAllRules] = useState<LogRule[]>([]);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(new Set());
  const [isRuleConfigOpen, setIsRuleConfigOpen] = useState(false);

  // Analysis State
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('severity_desc');

  useEffect(() => {
      // Load rules on mount so we can populate the selector
      const rules = getRules();
      setAllRules(rules);
      setSelectedRuleIds(new Set(rules.map(r => r.id)));
  }, []);

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    setReport(null);
    setSelectedIssueId(null);
    setExpandedGroupIds(new Set());
    
    try {
      const text = await file.text();
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Filter rules based on selection
      const activeRules = allRules.filter(r => selectedRuleIds.has(r.id));
      
      const result = await analyzeLog(text, file.name, activeRules);
      setReport(result);
    } catch (err) {
      console.error(err);
      alert("无法解析文件");
    } finally {
      setIsProcessing(false);
    }
  };

  const getSeverityColor = (sev: ErrorSeverity) => {
    switch (sev) {
      case ErrorSeverity.CRITICAL: return 'bg-red-100 text-red-800 border-red-200';
      case ErrorSeverity.ERROR: return 'bg-orange-100 text-orange-800 border-orange-200';
      case ErrorSeverity.WARNING: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getSeverityWeight = (sev: ErrorSeverity) => {
      if (sev === ErrorSeverity.CRITICAL) return 3;
      if (sev === ErrorSeverity.ERROR) return 2;
      return 1;
  };

  const getIssueId = (issue: AnalyzedIssue) => `${issue.ruleId}-${issue.lineNumber}`;

  // --- Grouping & Sorting Logic ---
  const groupedIssues = useMemo(() => {
      if (!report) return [];

      const groups: Record<string, IssueGroup> = {};
      const lowerFilter = filterText.toLowerCase();

      report.issues.forEach(issue => {
          // Filtering
          if (filterText) {
             const match = issue.ruleName.toLowerCase().includes(lowerFilter) || 
                           issue.matchContent.toLowerCase().includes(lowerFilter);
             if (!match) return;
          }

          if (!groups[issue.ruleId]) {
              groups[issue.ruleId] = {
                  ruleId: issue.ruleId,
                  ruleName: issue.ruleName,
                  severity: issue.severity,
                  issues: []
              };
          }
          groups[issue.ruleId].issues.push(issue);
      });

      let result = Object.values(groups);

      // Sorting Groups
      result.sort((a, b) => {
          if (sortOrder === 'severity_desc') {
              const wa = getSeverityWeight(a.severity);
              const wb = getSeverityWeight(b.severity);
              if (wa !== wb) return wb - wa;
              return b.issues.length - a.issues.length; // secondary sort by count
          }
          if (sortOrder === 'count_desc') {
              return b.issues.length - a.issues.length;
          }
          if (sortOrder === 'name_asc') {
              return a.ruleName.localeCompare(b.ruleName);
          }
          return 0;
      });

      return result;
  }, [report, filterText, sortOrder]);

  // --- Interaction Handlers ---
  const toggleGroup = (ruleId: string) => {
      const newSet = new Set(expandedGroupIds);
      if (newSet.has(ruleId)) {
          newSet.delete(ruleId);
      } else {
          newSet.add(ruleId);
      }
      setExpandedGroupIds(newSet);
  };

  const selectIssue = (issue: AnalyzedIssue) => {
      setSelectedIssueId(getIssueId(issue));
  };

  // --- Deriving Selected Issue Data for Right Panel ---
  const selectedIssueData = useMemo(() => {
      if (!selectedIssueId || !report) return null;
      
      // Find the issue in the raw list to get details
      const issue = report.issues.find(i => getIssueId(i) === selectedIssueId);
      if (!issue) return null;

      // Find its group context for pagination
      // We re-use the `groupedIssues` logic to ensure we respect current filters/sort
      const group = groupedIssues.find(g => g.ruleId === issue.ruleId);
      
      if (!group) return { issue, index: 0, total: 1, prevId: null, nextId: null };

      const index = group.issues.findIndex(i => getIssueId(i) === selectedIssueId);
      const prevId = index > 0 ? getIssueId(group.issues[index - 1]) : null;
      const nextId = index < group.issues.length - 1 ? getIssueId(group.issues[index + 1]) : null;

      return { issue, index, total: group.issues.length, prevId, nextId };

  }, [selectedIssueId, report, groupedIssues]);


  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">构建日志分析 (Build Analysis)</h1>
        <p className="text-slate-500 mt-2">上传您的 Editor.log 或 Player.log 以检测常见的 Unity 构建错误。</p>
      </div>

      {!report && (
        <div className="max-w-2xl mx-auto mt-12 relative">
          {/* Rule Config Button */}
          <div className="absolute -top-10 right-0">
              <button 
                onClick={() => setIsRuleConfigOpen(true)}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                配置规则 ({selectedRuleIds.size}/{allRules.length})
              </button>
          </div>

          <FileUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />
          {isProcessing && (
            <div className="mt-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
              <p className="mt-3 text-slate-600 font-medium">正在解析日志文件并匹配规则...</p>
            </div>
          )}
        </div>
      )}

      {report && (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-200px)]">
          {/* Left Panel: Grouped Issue List */}
          <div className="w-full lg:w-1/3 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
            
            {/* Header & Controls */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h2 className="font-semibold text-slate-700">问题列表 ({groupedIssues.length} 类)</h2>
                <button 
                    onClick={() => setReport(null)}
                    className="text-xs text-slate-500 hover:text-red-600 underline"
                >
                    重置 / 上传新文件
                </button>
              </div>
              
              <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="搜索规则或内容..."
                    value={filterText}
                    onChange={e => setFilterText(e.target.value)}
                    className="flex-1 text-xs border border-slate-300 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-500 outline-none bg-[#FCFCFC]"
                  />
                  <select 
                    value={sortOrder} 
                    onChange={e => setSortOrder(e.target.value as SortOrder)}
                    className="text-xs border border-slate-300 rounded px-2 py-1 outline-none bg-[#FCFCFC]"
                  >
                      <option value="severity_desc">严重程度</option>
                      <option value="count_desc">数量 (多到少)</option>
                      <option value="name_asc">名称 (A-Z)</option>
                  </select>
              </div>
            </div>

            {/* Grouped List Content */}
            <div className="overflow-y-auto flex-1 p-2 space-y-2">
              {groupedIssues.length === 0 ? (
                 <div className="text-center py-10 text-slate-400">
                    {filterText ? '未找到匹配项' : '未发现已知问题'}
                 </div>
              ) : (
                groupedIssues.map((group) => {
                  const isExpanded = expandedGroupIds.has(group.ruleId);
                  const activeIssueInGroup = selectedIssueData && selectedIssueData.issue.ruleId === group.ruleId;

                  return (
                    <div key={group.ruleId} className={`rounded-lg border transition-all ${activeIssueInGroup ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-200 bg-white'}`}>
                        {/* Group Header */}
                        <div 
                            onClick={() => toggleGroup(group.ruleId)}
                            className="p-3 cursor-pointer flex justify-between items-center hover:bg-slate-50"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${getSeverityColor(group.severity)}`}>
                                        {group.severity}
                                    </span>
                                    <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-mono font-bold">
                                        {group.issues.length}
                                    </span>
                                </div>
                                <h4 className="text-sm font-semibold text-slate-800 truncate">{group.ruleName}</h4>
                            </div>
                            <div className={`transform transition-transform text-slate-400 ${isExpanded ? 'rotate-180' : ''}`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>

                        {/* Expanded Instances List */}
                        {isExpanded && (
                            <div className="border-t border-slate-100 bg-slate-50/50 max-h-60 overflow-y-auto custom-scrollbar">
                                {group.issues.map((issue, idx) => {
                                    const issueId = getIssueId(issue);
                                    const isSelected = selectedIssueId === issueId;
                                    return (
                                        <div 
                                            key={issueId}
                                            onClick={() => selectIssue(issue)}
                                            className={`
                                                px-4 py-2 text-xs cursor-pointer border-l-4 border-transparent hover:bg-slate-100 flex justify-between items-center
                                                ${isSelected ? '!border-indigo-500 bg-white shadow-sm' : 'text-slate-500'}
                                            `}
                                        >
                                            <span className="font-mono">Line {issue.lineNumber}</span>
                                            <span className="truncate max-w-[180px] text-slate-400 opacity-70 ml-2 text-[10px]">{issue.matchContent}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                  );
                })
              )}
            </div>
            
            <div className="p-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-400 text-center">
              共 {report.issues.length} 个问题，耗时 {report.durationMs}ms
            </div>
          </div>

          {/* Right Panel: Detail View with Pagination */}
          <div className="w-full lg:w-2/3 flex flex-col gap-6">
            {selectedIssueData ? (
              <>
                {/* Solution Card with Pagination Header */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col">
                   {/* Pagination / Navigation Header */}
                   <div className="px-6 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-xl">
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <span className={`w-2 h-2 rounded-full ${selectedIssueData.issue.severity === ErrorSeverity.CRITICAL ? 'bg-red-500' : selectedIssueData.issue.severity === ErrorSeverity.ERROR ? 'bg-orange-500' : 'bg-yellow-500'}`}></span>
                            <span className="font-medium text-slate-700">{selectedIssueData.issue.ruleName}</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-mono text-slate-400">
                                {selectedIssueData.index + 1} / {selectedIssueData.total}
                            </span>
                            <div className="flex gap-1">
                                <button 
                                    onClick={() => selectedIssueData.prevId && setSelectedIssueId(selectedIssueData.prevId)}
                                    disabled={!selectedIssueData.prevId}
                                    className="p-1.5 rounded hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none text-slate-600"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                                </button>
                                <button 
                                    onClick={() => selectedIssueData.nextId && setSelectedIssueId(selectedIssueData.nextId)}
                                    disabled={!selectedIssueData.nextId}
                                    className="p-1.5 rounded hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:shadow-none text-slate-600"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        </div>
                   </div>

                   <div className="p-6">
                        <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>
                            建议解决方案
                        </h3>
                        <div className="prose prose-sm prose-slate max-w-none bg-slate-50 p-4 rounded-lg border border-slate-100">
                            <ReactMarkdown>{selectedIssueData.issue.solution}</ReactMarkdown>
                        </div>
                   </div>
                </div>

                {/* Stack Trace Card */}
                <div className="bg-slate-900 rounded-xl shadow-sm border border-slate-800 flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div className="p-3 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                     <div className="flex items-center gap-3">
                         <span className="text-slate-300 text-sm font-mono">日志上下文 (Context)</span>
                         <span className="text-xs text-slate-500 font-mono px-2 py-0.5 bg-slate-800 rounded border border-slate-700">Line {selectedIssueData.issue.lineNumber}</span>
                     </div>
                     <button 
                       onClick={() => navigator.clipboard.writeText(selectedIssueData.issue.context.join('\n'))}
                       className="text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2 py-1 rounded transition-colors"
                     >
                       复制
                     </button>
                  </div>
                  <div className="p-4 overflow-auto font-mono text-xs text-slate-300 flex-1 custom-scrollbar">
                    {selectedIssueData.issue.context.map((line, i) => {
                       // Highlight the matched line
                       const isTarget = line.trim() === selectedIssueData.issue.matchContent.trim();
                       return (
                         <div key={i} className={`${isTarget ? 'bg-red-500/20 text-red-200 -mx-4 px-4 py-1 border-l-2 border-red-500' : 'py-0.5 opacity-70 hover:opacity-100'}`}>
                           {line}
                         </div>
                       );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                    <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p>请从左侧选择一个问题查看详情</p>
                <p className="text-xs text-slate-400 mt-2">点击问题组可展开查看具体行号</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rule Configuration Modal */}
      {isRuleConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl h-[600px] flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
               <h3 className="text-lg font-bold text-slate-800">选择生效规则</h3>
               <button onClick={() => setIsRuleConfigOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
               </button>
            </div>
            
            <div className="p-4 flex-1 overflow-hidden">
               <RuleSelector 
                  rules={allRules} 
                  selectedIds={selectedRuleIds} 
                  onSelectionChange={setSelectedRuleIds} 
               />
            </div>
            
            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-xl">
               <button onClick={() => setIsRuleConfigOpen(false)} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800">
                 确定
               </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Analyzer;