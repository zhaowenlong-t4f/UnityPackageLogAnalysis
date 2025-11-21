import React, { useEffect, useState } from 'react';
import { deleteRule, getRules, saveRule, saveRulesBulk, clearRules, resetRulesToDefaults, analyzeLog } from '../services/analysisEngine';
import { generateRuleFromLog } from '../services/geminiService';
import { AnalyzedIssue, ErrorSeverity, LogRule } from '../types';
import { v4 as uuidv4 } from 'uuid';
import RuleSelector from '../components/RuleSelector';

const PAGE_SIZE = 8;

const KnowledgeBase: React.FC = () => {
  const [rules, setRules] = useState<LogRule[]>([]);
  
  // List View State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false); // New: Playground Modal
  
  // Form State
  const [formData, setFormData] = useState<Partial<LogRule>>({
    name: '',
    regex: '',
    keywords: [],
    solution: '',
    severity: ErrorSeverity.ERROR,
    weight: 10
  });
  
  // AI Assistant State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiReason, setAiReason] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);

  // Playground State
  const [playgroundLog, setPlaygroundLog] = useState('');
  const [playgroundSelectedRules, setPlaygroundSelectedRules] = useState<Set<string>>(new Set());
  const [playgroundResults, setPlaygroundResults] = useState<AnalyzedIssue[] | null>(null);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = () => {
    const loaded = getRules();
    setRules(loaded);
    // Default select all for playground initially
    setPlaygroundSelectedRules(new Set(loaded.map(r => r.id)));
  };

  // --- Filtering & Pagination Logic ---
  // Filter then SORT by Weight (Descending)
  const filteredRules = rules.filter(r => 
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.regex.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.keywords.some(k => k.toLowerCase().includes(searchTerm.toLowerCase()))
  ).sort((a, b) => (b.weight || 0) - (a.weight || 0));

  const totalPages = Math.ceil(filteredRules.length / PAGE_SIZE);
  const paginatedRules = filteredRules.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // --- Actions ---
  const handleDelete = (id: string) => {
    if (confirm('确定要删除这条规则吗？')) {
      deleteRule(id);
      loadRules();
    }
  };

  const handleClear = () => {
    if (confirm('警告：确定要清空所有规则吗？\n此操作将删除所有规则且不可恢复！')) {
      clearRules();
      loadRules();
    }
  };

  const handleReset = () => {
    if (confirm('确定要重置为默认规则吗？\n这将清除您添加的所有自定义规则并恢复初始状态。')) {
      resetRulesToDefaults();
      loadRules();
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.regex) {
      alert("名称和正则表达式是必填项");
      return;
    }

    // Deduplication check on Save (for new rules)
    if (!formData.id) {
        const exists = rules.some(r => r.regex === formData.regex);
        if (exists) {
            alert("错误：库中已存在相同的正则表达式规则！");
            return;
        }
    }

    const newRule: LogRule = {
      id: formData.id || uuidv4(),
      name: formData.name!,
      regex: formData.regex!,
      keywords: formData.keywords || [],
      solution: formData.solution || '',
      severity: formData.severity || ErrorSeverity.ERROR,
      weight: formData.weight || 10
    };

    saveRule(newRule);
    setIsModalOpen(false);
    loadRules();
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      regex: '',
      keywords: [],
      solution: '',
      severity: ErrorSeverity.ERROR,
      weight: 10
    });
    setAiPrompt('');
    setAiReason('');
    setShowAiPanel(false);
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt || !aiReason) {
      alert("请提供日志片段和原因描述。");
      return;
    }
    setIsGenerating(true);
    try {
      const result = await generateRuleFromLog(aiPrompt, aiReason);
      setFormData(prev => ({
        ...prev,
        regex: result.regex,
        keywords: result.keywords,
        solution: prev.solution || `**${result.explanation}**\n\n由 AI 生成，请复核。`
      }));
      alert("规则生成成功！请检查 Regex。");
    } catch (e) {
      console.error(e);
      alert("规则生成失败，请检查 API Key。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = () => {
    const currentRules = getRules();
    const blob = new Blob([JSON.stringify(currentRules, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unity_log_rules_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Import Logic ---
  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!Array.isArray(json)) {
          alert("JSON 格式错误：根节点必须是数组");
          return;
        }

        const currentRules = getRules();
        let addedCount = 0;
        let duplicateCount = 0;
        const newRules = [...currentRules];

        // Deduplication based on Regex string
        json.forEach((item: any) => {
          if (item.name && item.regex) {
             const exists = newRules.some(r => r.regex === item.regex);
             if (!exists) {
               newRules.push({
                 ...item,
                 id: uuidv4(), // Always assign new ID to avoid conflicts
                 keywords: item.keywords || [],
                 weight: item.weight || 10,
                 severity: item.severity || ErrorSeverity.ERROR
               });
               addedCount++;
             } else {
               duplicateCount++;
             }
          }
        });

        saveRulesBulk(newRules);
        setRules(newRules);
        setIsImportModalOpen(false);
        alert(`导入完成！\n新增: ${addedCount} 条\n跳过重复: ${duplicateCount} 条`);
      } catch (err) {
        console.error(err);
        alert("JSON 解析失败");
      }
    };
    reader.readAsText(file);
  };

  // --- Playground Logic ---
  const runPlaygroundTest = async () => {
    if(!playgroundLog.trim()) return;
    
    const activeRules = rules.filter(r => playgroundSelectedRules.has(r.id));
    const report = await analyzeLog(playgroundLog, 'test_log.txt', activeRules);
    setPlaygroundResults(report.issues);
  };

  const jsonTemplate = `[
  {
    "name": "Example Error Rule",
    "regex": "Error: (.*)",
    "keywords": ["Error"],
    "solution": "Fix the error.",
    "severity": "ERROR",
    "weight": 10
  }
]`;

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">知识库管理 (Knowledge Base)</h1>
          <p className="text-slate-500 mt-2">管理分析引擎的正则表达式规则。</p>
        </div>
        <div className="flex flex-wrap gap-2">
            {/* Utility Buttons */}
             <button 
              onClick={() => setIsPlaygroundOpen(true)}
              className="bg-white border border-indigo-200 text-indigo-600 px-3 py-2 rounded-lg font-medium hover:bg-indigo-50 transition-colors shadow-sm flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              规则测试 (Playground)
            </button>

            <button 
              onClick={handleReset}
              className="bg-white border border-slate-300 text-slate-600 px-3 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              重置默认
            </button>

            <button 
              onClick={handleClear}
              className="bg-white border border-red-200 text-red-600 px-3 py-2 rounded-lg font-medium hover:bg-red-50 transition-colors shadow-sm flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              清空
            </button>

            <div className="w-px bg-slate-300 mx-1 my-2"></div>

            <button 
            onClick={handleExport}
            className="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2 text-sm"
            >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            导出 (JSON)
            </button>

            <button 
            onClick={() => setIsImportModalOpen(true)}
            className="bg-white border border-slate-300 text-slate-700 px-3 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors shadow-sm flex items-center gap-2 text-sm"
            >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            导入 (JSON)
            </button>
            
            <button 
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2 text-sm"
            >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            新建规则
            </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          </div>
          <input 
            type="text"
            placeholder="搜索规则名称、关键字或正则表达式..." 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-white placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>
      </div>

      {/* Rules Table */}
      <div className="bg-white shadow-sm border border-slate-200 rounded-xl overflow-hidden flex flex-col min-h-[500px]">
        <table className="min-w-full divide-y divide-slate-200 flex-1">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">优先级</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">规则名称 / 正则</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">严重程度</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">关键词</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {paginatedRules.length === 0 ? (
                <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        {rules.length === 0 ? '知识库为空，请点击“重置默认”或“新建规则”' : '没有找到匹配的规则'}
                    </td>
                </tr>
            ) : paginatedRules.map(rule => (
              <tr key={rule.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-full text-xs font-mono font-bold">
                    {rule.weight || 0}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-bold text-slate-900">{rule.name}</div>
                  <div className="text-xs text-slate-500 font-mono mt-1 truncate max-w-md bg-slate-100 px-2 py-1 rounded inline-block" title={rule.regex}>{rule.regex}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                   <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-bold rounded-full border
                     ${rule.severity === ErrorSeverity.CRITICAL ? 'bg-red-50 text-red-700 border-red-200' : 
                       rule.severity === ErrorSeverity.ERROR ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                     {rule.severity}
                   </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  <div className="flex gap-1 flex-wrap max-w-xs">
                    {rule.keywords.slice(0,3).map(k => (
                      <span key={k} className="bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-xs">{k}</span>
                    ))}
                    {rule.keywords.length > 3 && <span className="text-xs text-slate-400 self-center">+{rule.keywords.length - 3}</span>}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    onClick={() => { setFormData(rule); setIsModalOpen(true); }}
                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                  >
                    编辑
                  </button>
                  <button 
                    onClick={() => handleDelete(rule.id)}
                    className="text-red-600 hover:text-red-900"
                  >
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
            <div className="px-6 py-3 flex items-center justify-between border-t border-slate-200 bg-slate-50">
                <div className="text-sm text-slate-500">
                    显示 {(currentPage - 1) * PAGE_SIZE + 1} 到 {Math.min(currentPage * PAGE_SIZE, filteredRules.length)} 条，共 {filteredRules.length} 条
                </div>
                <div className="flex gap-1">
                    <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        上一页
                    </button>
                    <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border border-slate-300 rounded-md text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        下一页
                    </button>
                </div>
            </div>
        )}
      </div>

      {/* Playground Modal */}
      {isPlaygroundOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                        规则测试实验室 (Playground)
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">手动输入日志堆栈，验证规则命中情况。</p>
                </div>
                <button onClick={() => { setIsPlaygroundOpen(false); setPlaygroundResults(null); }} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left: Rule Selector */}
                <div className="w-1/3 border-r border-slate-200 flex flex-col bg-slate-50/50">
                    <div className="p-4 bg-white border-b border-slate-100">
                        <h3 className="text-sm font-bold text-slate-700">1. 选择生效规则</h3>
                        <p className="text-xs text-slate-400">仅选中的规则参与测试匹配。</p>
                    </div>
                    <div className="flex-1 p-4 overflow-hidden">
                         <RuleSelector 
                            rules={rules} 
                            selectedIds={playgroundSelectedRules} 
                            onSelectionChange={setPlaygroundSelectedRules} 
                         />
                    </div>
                </div>

                {/* Center/Right: Input & Result */}
                <div className="flex-1 flex flex-col p-6 gap-4 overflow-y-auto">
                     {/* Input */}
                     <div className="flex-shrink-0">
                        <label className="block text-sm font-bold text-slate-700 mb-2">2. 输入日志堆栈 / 错误信息</label>
                        <textarea 
                            value={playgroundLog}
                            onChange={e => setPlaygroundLog(e.target.value)}
                            className="w-full h-32 p-3 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-[#FCFCFC]"
                            placeholder="粘贴包含错误的日志行..."
                        />
                        <div className="mt-2 flex justify-end">
                            <button 
                                onClick={runPlaygroundTest}
                                disabled={!playgroundLog.trim()}
                                className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
                            >
                                运行测试
                            </button>
                        </div>
                     </div>

                     {/* Results */}
                     <div className="flex-1 flex flex-col min-h-0">
                        <h3 className="text-sm font-bold text-slate-700 mb-2">3. 测试结果</h3>
                        <div className="flex-1 border border-slate-200 rounded-lg bg-slate-50 overflow-y-auto p-4 custom-scrollbar">
                            {!playgroundResults ? (
                                <div className="text-center text-slate-400 py-10">请运行测试查看结果</div>
                            ) : playgroundResults.length === 0 ? (
                                <div className="text-center text-slate-500 py-10 flex flex-col items-center">
                                    <svg className="w-10 h-10 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span>未命中任何选中的规则</span>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {playgroundResults.map((issue, idx) => (
                                        <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                                        issue.severity === ErrorSeverity.CRITICAL ? 'bg-red-100 text-red-800 border-red-200' : 
                                                        issue.severity === ErrorSeverity.ERROR ? 'bg-orange-100 text-orange-800 border-orange-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200'
                                                    }`}>
                                                        {issue.severity}
                                                    </span>
                                                    <span className="font-bold text-sm text-slate-800">{issue.ruleName}</span>
                                                </div>
                                                <span className="text-xs text-slate-400 font-mono">Line {issue.lineNumber}</span>
                                            </div>
                                            <div className="bg-slate-900 text-slate-300 p-2 rounded text-[10px] font-mono mb-2 overflow-x-auto">
                                                {issue.matchContent}
                                            </div>
                                            <div className="text-xs text-slate-600">
                                                <span className="font-semibold">方案预览:</span> {issue.solution.slice(0, 100)}...
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                     </div>
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-800">导入规则 (JSON)</h3>
                    <button onClick={() => setIsImportModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <div className="p-6">
                    <div className="mb-4">
                        <p className="text-sm text-slate-600 mb-2">请上传符合以下格式的 .json 文件。系统会自动跳过 Regex 重复的规则。</p>
                        <div className="bg-slate-900 rounded-lg p-4 overflow-x-auto">
                            <pre className="text-xs text-slate-300 font-mono">{jsonTemplate}</pre>
                        </div>
                    </div>
                    <div className="mt-6">
                        <label className="block w-full cursor-pointer">
                            <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg hover:bg-slate-50 transition-colors">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <svg className="w-8 h-8 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                    <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">点击上传</span> JSON 文件</p>
                                </div>
                                <input type="file" accept=".json" className="hidden" onChange={handleJsonImport} />
                            </div>
                        </label>
                    </div>
                </div>
             </div>
          </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-slate-800">{formData.id ? '编辑规则' : '新建规则'}</h2>
              <button 
                onClick={() => setShowAiPanel(!showAiPanel)}
                className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors border ${showAiPanel ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-indigo-600 border-indigo-200 hover:border-indigo-600'}`}
              >
                ✨ AI 助手 {showAiPanel ? '开启' : '关闭'}
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
               {/* AI Panel */}
               {showAiPanel && (
                 <div className="w-1/3 bg-indigo-50 border-r border-indigo-100 p-6 flex flex-col gap-4 overflow-y-auto">
                    <div>
                      <label className="block text-xs font-bold text-indigo-900 uppercase mb-1">原始日志片段 (Log Snippet)</label>
                      <textarea 
                        value={aiPrompt}
                        onChange={e => setAiPrompt(e.target.value)}
                        placeholder="在此粘贴报错的日志行..."
                        className="w-full h-32 p-3 text-xs font-mono border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-[#FCFCFC]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-indigo-900 uppercase mb-1">原因描述 (Cause)</label>
                      <textarea 
                        value={aiReason}
                        onChange={e => setAiReason(e.target.value)}
                        placeholder="简单描述为什么会发生这个错误..."
                        className="w-full h-20 p-3 text-sm border border-indigo-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-[#FCFCFC]"
                      />
                    </div>
                    <button
                      onClick={handleAiGenerate}
                      disabled={isGenerating}
                      className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 flex justify-center items-center gap-2"
                    >
                      {isGenerating ? '生成中...' : '生成 Regex'}
                    </button>
                    <div className="text-xs text-indigo-800/60 italic">
                      提示: AI 生成的结果将自动填充右侧表单。
                    </div>
                 </div>
               )}

               {/* Main Form */}
               <div className="flex-1 p-6 overflow-y-auto space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">规则名称</label>
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-[#FCFCFC] text-slate-800"
                      placeholder="例如：贴图导入失败"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">严重程度</label>
                      <div className="relative">
                          <select 
                            value={formData.severity}
                            onChange={e => setFormData({...formData, severity: e.target.value as ErrorSeverity})}
                            className="w-full border border-slate-300 rounded-lg p-2 pr-8 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none text-slate-700 font-medium bg-[#FCFCFC]"
                          >
                            {Object.values(ErrorSeverity).map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-700">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                          </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">优先级 (Weight)</label>
                      <input 
                        type="number" 
                        value={formData.weight}
                        onChange={e => setFormData({...formData, weight: parseInt(e.target.value) || 0})}
                        className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-[#FCFCFC] text-slate-800"
                        placeholder="10"
                      />
                      <div className="text-[10px] text-slate-400 mt-1">数值越高，匹配优先级越高</div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">关键词 (预筛选, 逗号分隔)</label>
                    <input 
                    type="text" 
                    value={formData.keywords?.join(', ')}
                    onChange={e => setFormData({...formData, keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k)})}
                    className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 outline-none bg-[#FCFCFC] text-slate-800"
                    placeholder="error, import, texture"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">正则表达式 (Python/JS 风格)</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={formData.regex}
                        onChange={e => setFormData({...formData, regex: e.target.value})}
                        className="w-full border border-slate-300 rounded-lg p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-[#FCFCFC] text-slate-800"
                        placeholder="Error: (.*)"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">解决方案 (支持 Markdown)</label>
                    <textarea 
                      value={formData.solution}
                      onChange={e => setFormData({...formData, solution: e.target.value})}
                      className="w-full h-32 border border-slate-300 rounded-lg p-2 font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-[#FCFCFC] text-slate-800"
                      placeholder="**修复步骤:**..."
                    />
                  </div>
               </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
               <button 
                 onClick={() => setIsModalOpen(false)}
                 className="px-4 py-2 text-slate-600 font-medium hover:text-slate-800"
               >
                 取消
               </button>
               <button 
                 onClick={handleSave}
                 className="px-6 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 shadow-sm"
               >
                 保存规则
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;