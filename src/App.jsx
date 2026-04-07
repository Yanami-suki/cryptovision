import React, { useState, useEffect, useRef } from 'react';
import { 
  Bell, 
  TrendingUp, 
  Settings, 
  AlertCircle, 
  Trash2, 
  Plus, 
  CheckCircle, 
  Mail,
  Search,
  Activity,
  Sparkles,
  X,
  Loader2
} from 'lucide-react';

// --- 模拟的 Toast 通知系统 ---
const ToastContainer = ({ toasts, removeToast }) => (
  <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
    {toasts.map((toast) => (
      <div 
        key={toast.id} 
        className="bg-gray-800 border-l-4 border-blue-500 shadow-lg rounded-r-md p-4 flex items-start gap-3 w-80 animate-slide-in"
      >
        <div className="text-blue-500 mt-1">
          {toast.type === 'alert' ? <AlertCircle size={20} /> : <CheckCircle size={20} className="text-green-500" />}
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-white">{toast.title}</h4>
          <p className="text-xs text-gray-400 mt-1">{toast.message}</p>
        </div>
        <button onClick={() => removeToast(toast.id)} className="text-gray-500 hover:text-white">
          &times;
        </button>
      </div>
    ))}
  </div>
);

// --- TradingView 高级图表组件 (原生支持画图和指标) ---
let tvScriptLoadingPromise;

const TradingViewWidget = ({ symbol }) => {
  const onLoadScriptRef = useRef();
  const containerId = "tv_chart_container";

  useEffect(() => {
    onLoadScriptRef.current = createWidget;

    if (!tvScriptLoadingPromise) {
      tvScriptLoadingPromise = new Promise((resolve) => {
        const script = document.createElement('script');
        script.id = 'tradingview-widget-loading-script';
        script.src = 'https://s3.tradingview.com/tv.js';
        script.type = 'text/javascript';
        script.onload = resolve;
        document.head.appendChild(script);
      });
    }

    tvScriptLoadingPromise.then(() => onLoadScriptRef.current && onLoadScriptRef.current());

    return () => {
      onLoadScriptRef.current = null;
    };

    function createWidget() {
      if (document.getElementById(containerId) && 'TradingView' in window) {
        // 清空之前的图表实例，防止 React 重新渲染导致白屏
        document.getElementById(containerId).innerHTML = ''; 
        
        new window.TradingView.widget({
          autosize: true,
          symbol: symbol,
          interval: "15",
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "zh_CN",
          enable_publishing: false,
          backgroundColor: "#1e222d",
          gridColor: "#2b313f",
          hide_top_toolbar: false,
          hide_legend: false,
          hide_side_toolbar: false, // 明确要求显示左侧画图工具栏
          allow_symbol_change: true,
          save_image: false,
          container_id: containerId,
          toolbar_bg: "#1e222d",
          // 默认加载一些常用指标
          studies: [
            "MACD@tv-basicstudies",
            "RSI@tv-basicstudies",
            "MASimple@tv-basicstudies"
          ],
          disabled_features: ["header_symbol_search"] // 我们自己实现顶部搜索
        });
      }
    }
  }, [symbol]);

  return (
    <div className="w-full h-full rounded-lg overflow-hidden border border-gray-700 relative">
      {/* 添加一个加载提示背景 */}
      <div className="absolute inset-0 flex items-center justify-center text-gray-500 -z-10">
        正在加载专业图表与画图工具...
      </div>
      <div id={containerId} className="w-full h-full z-10" />
    </div>
  );
};

// --- 主应用组件 ---
export default function App() {
  const [currentSymbol, setCurrentSymbol] = useState('BTCUSDT');
  const [searchInput, setSearchInput] = useState('BTCUSDT');
  
  // AI 分析状态
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState('');
  const [showAiModal, setShowAiModal] = useState(false);

  // 预警状态
  const [alerts, setAlerts] = useState([]);
  const [toasts, setToasts] = useState([]);
  
  // 表单状态
  const [formSymbol, setFormSymbol] = useState('BTCUSDT');
  const [formCondition, setFormCondition] = useState('above');
  const [formPrice, setFormPrice] = useState('');
  const [formEmail, setFormEmail] = useState(true);

  // 获取实时价格的辅助函数
  const fetchCurrentPrice = async (sym) => {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`);
      if (!res.ok) throw new Error('Network response was not ok');
      const data = await res.json();
      return parseFloat(data.price);
    } catch (error) {
      console.error("获取价格失败", error);
      return null;
    }
  };

  // 添加预警
  const handleAddAlert = async (e) => {
    e.preventDefault();
    const isPriceCondition = formCondition === 'above' || formCondition === 'below';
    if (isPriceCondition && (!formPrice || isNaN(formPrice))) return;

    const newAlert = {
      id: Date.now().toString(),
      symbol: formSymbol.toUpperCase(),
      condition: formCondition,
      targetPrice: isPriceCondition ? parseFloat(formPrice) : null,
      notifyEmail: formEmail,
      status: 'active', // active, triggered
      createdAt: new Date().toLocaleString()
    };

    setAlerts([newAlert, ...alerts]);
    addToast('成功', `已添加 ${newAlert.symbol} 预警`, 'success');
    if (isPriceCondition) setFormPrice('');
  };

  // 删除预警
  const deleteAlert = (id) => {
    setAlerts(alerts.filter(a => a.id !== id));
  };

  // Toast 管理
  const addToast = (title, message, type = 'alert') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // 轮询监控价格逻辑 (模拟后端定时任务)
  useEffect(() => {
    const checkAlerts = async () => {
      const activeAlerts = alerts.filter(a => a.status === 'active');
      if (activeAlerts.length === 0) return;

      // 获取需要检查的去重币种列表
      const symbolsToCheck = [...new Set(activeAlerts.map(a => a.symbol))];
      
      for (const sym of symbolsToCheck) {
        const currentPrice = await fetchCurrentPrice(sym);
        if (currentPrice === null) continue;

        // 检查该币种的所有活跃预警
        setAlerts(prevAlerts => prevAlerts.map(alert => {
          if (alert.symbol === sym && alert.status === 'active') {
            let triggered = false;
            let conditionText = '';

            // 价格条件判断
            if (alert.condition === 'above' && currentPrice >= alert.targetPrice) {
              triggered = true;
              conditionText = `突破 ${alert.targetPrice}`;
            } else if (alert.condition === 'below' && currentPrice <= alert.targetPrice) {
              triggered = true;
              conditionText = `跌破 ${alert.targetPrice}`;
            } 
            // 指标条件判断 (模拟后端触发，为了演示设置 5% 的随机触发概率)
            else if (!['above', 'below'].includes(alert.condition)) {
              if (Math.random() < 0.05) {
                triggered = true;
                if (alert.condition === 'rsi_over') conditionText = '触发 RSI 超买 (>70)';
                if (alert.condition === 'rsi_under') conditionText = '触发 RSI 超卖 (<30)';
                if (alert.condition === 'macd_golden') conditionText = '触发 MACD 金叉';
                if (alert.condition === 'macd_death') conditionText = '触发 MACD 死叉';
              }
            }

            if (triggered) {
              // 触发通知
              const emailMsg = alert.notifyEmail ? '(已发送邮件通知)' : '';
              addToast(
                '价格预警触发！', 
                `${alert.symbol} 价格已 ${conditionText}。当前价格: ${currentPrice} ${emailMsg}`,
                'alert'
              );
              return { ...alert, status: 'triggered', triggeredAt: new Date().toLocaleString() };
            }
          }
          return alert;
        }));
      }
    };

    // 每 5 秒检查一次价格
    const interval = setInterval(checkAlerts, 5000);
    return () => clearInterval(interval);
  }, [alerts]);

  // 处理图表币种切换
  const handleSymbolSearch = (e) => {
    e.preventDefault();
    if (searchInput) {
      setCurrentSymbol(searchInput.toUpperCase());
      setFormSymbol(searchInput.toUpperCase());
    }
  };

  // --- Gemini API 集成：AI 智能分析 ---
  const fetchGeminiAnalysis = async (symbol) => {
    // ⚠️ 注意：请在这里填入你申请的真实 API Key
    const apiKey = ""; 
    const prompt = `作为一名前沿的加密货币量化分析师，请对 ${symbol} 进行简明扼要的市场基本面和技术面综合评估。包含：\n1. 市场当前情绪与宏观背景（简述）\n2. 潜在的关键支撑位和阻力位估算（说明逻辑）\n3. 短期交易风险提示。\n请保持客观理智，排版清晰，分点作答。`;
    
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: "你是一个专业的加密货币市场分析师。必须使用中文回复，态度客观中立。" }] }
    };

    let retries = 5;
    const delays = [1000, 2000, 4000, 8000, 16000];

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const result = await response.json();
        return result.candidates?.[0]?.content?.parts?.[0]?.text || "暂无分析结果";
      } catch (error) {
        if (i === retries - 1) return "❌ 抱歉，由于网络或服务原因，暂时无法获取 Gemini AI 分析结果，请稍后再试。";
        await new Promise(res => setTimeout(res, delays[i]));
      }
    }
  };

  const handleGenerateAnalysis = async () => {
    setShowAiModal(true);
    setIsAiLoading(true);
    setAiAnalysisResult('');
    const result = await fetchGeminiAnalysis(currentSymbol);
    setAiAnalysisResult(result);
    setIsAiLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans flex flex-col">
      {/* 顶部导航 */}
      <header className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <TrendingUp size={20} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide">CryptoVision Pro</h1>
        </div>
        
        <div className="flex items-center gap-6">
          <form onSubmit={handleSymbolSearch} className="relative">
            <input 
              type="text" 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="例如: BTCUSDT"
              className="bg-gray-900 border border-gray-700 text-sm rounded-full py-1.5 pl-4 pr-10 focus:outline-none focus:border-blue-500 w-48 transition-colors"
            />
            <button type="submit" className="absolute right-3 top-2 text-gray-400 hover:text-white">
              <Search size={16} />
            </button>
          </form>

          <div className="flex items-center gap-4 border-l border-gray-700 pl-6">
            <button className="text-gray-400 hover:text-white transition-colors"><Bell size={20} /></button>
            <button className="text-gray-400 hover:text-white transition-colors"><Settings size={20} /></button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 border border-gray-600 cursor-pointer"></div>
          </div>
        </div>
      </header>

      {/* 主体内容 */}
      <main className="flex-1 flex overflow-hidden p-4 gap-4">
        
        {/* 左侧：TradingView 高级图表区域 */}
        <section className="flex-1 flex flex-col bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-2">
          <div className="flex justify-between items-center px-4 py-2 border-b border-gray-700/50 mb-2">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-blue-400" />
              <h2 className="font-semibold">高级专业图表 (包含画图工具与指标)</h2>
              <button
                onClick={handleGenerateAnalysis}
                className="ml-3 flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium transition-all shadow-lg shadow-purple-500/20"
                title="获取该资产的 AI 市场洞察"
              >
                <Sparkles size={14} />
                ✨ AI 智能分析
              </button>
            </div>
            <div className="flex items-center gap-3">
              {/* 快捷选择标的下拉菜单 */}
              <select
                value={currentSymbol}
                onChange={(e) => {
                  const sym = e.target.value;
                  setCurrentSymbol(sym);
                  setSearchInput(sym);
                  setFormSymbol(sym);
                }}
                className="bg-gray-900 border border-gray-700 text-sm rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-blue-500 cursor-pointer hover:bg-gray-800 transition-colors"
              >
                <option value="BTCUSDT">BTC/USDT</option>
                <option value="ETHUSDT">ETH/USDT</option>
                <option value="SOLUSDT">SOL/USDT</option>
                <option value="BNBUSDT">BNB/USDT</option>
                <option value="XRPUSDT">XRP/USDT</option>
                <option value="DOGEUSDT">DOGE/USDT</option>
              </select>
              <span className="text-xs text-gray-400 bg-gray-900 px-2 py-1 rounded">数据源: BINANCE</span>
            </div>
          </div>
          <div className="flex-1 w-full">
            {/* TV Widget 需要 BINANCE: 前缀以确保正确识别 */}
            <TradingViewWidget symbol={`BINANCE:${currentSymbol}`} />
          </div>
        </section>

        {/* 右侧：预警控制台 */}
        <section className="w-96 bg-gray-800 rounded-xl shadow-lg border border-gray-700 flex flex-col overflow-hidden shrink-0">
          <div className="p-5 border-b border-gray-700 bg-gray-800/50">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Bell size={20} className="text-yellow-500" />
              价格预警控制台
            </h2>
            <p className="text-xs text-gray-400 mt-1">设置条件，系统将在后台持续监控 (模拟实时轮询)</p>
          </div>

          <div className="p-5 border-b border-gray-700">
            <form onSubmit={handleAddAlert} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">交易对</label>
                  <input 
                    type="text" 
                    value={formSymbol}
                    onChange={(e) => setFormSymbol(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">触发条件</label>
                  <select 
                    value={formCondition}
                    onChange={(e) => setFormCondition(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded p-2 text-sm focus:outline-none focus:border-blue-500 text-gray-200"
                  >
                    <optgroup label="价格触发">
                      <option value="above">价格大于等于 (≥)</option>
                      <option value="below">价格小于等于 (≤)</option>
                    </optgroup>
                    <optgroup label="指标触发 (高级)">
                      <option value="rsi_over">RSI &gt; 70 (超买)</option>
                      <option value="rsi_under">RSI &lt; 30 (超卖)</option>
                      <option value="macd_golden">MACD 金叉</option>
                      <option value="macd_death">MACD 死叉</option>
                    </optgroup>
                  </select>
                </div>
              </div>

              {/* 动态显示价格输入框或指标提示 */}
              {(formCondition === 'above' || formCondition === 'below') ? (
                <div>
                  <label className="block text-xs text-gray-400 mb-1">目标价格 (USDT)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input 
                      type="number" 
                      step="any"
                      value={formPrice}
                      onChange={(e) => setFormPrice(e.target.value)}
                      placeholder="例如: 65000"
                      className="w-full bg-gray-900 border border-gray-700 rounded p-2 pl-7 text-sm focus:outline-none focus:border-blue-500"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="bg-blue-900/20 text-blue-400 p-3 text-xs rounded border border-blue-800/50 leading-relaxed">
                  <strong>后台指标监控已开启：</strong><br/>
                  系统将在服务端使用 15 分钟级别 K线数据，实时计算相关技术指标并在满足条件时立刻通知您。
                </div>
              )}

              <div className="flex items-center gap-2 mt-1">
                <input 
                  type="checkbox" 
                  id="notifyEmail"
                  checked={formEmail}
                  onChange={(e) => setFormEmail(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-900 border-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
                />
                <label htmlFor="notifyEmail" className="text-sm text-gray-300 flex items-center gap-1">
                  <Mail size={14} className="text-gray-400" />
                  发送邮件通知 (模拟)
                </label>
              </div>

              <button 
                type="submit" 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded transition-colors flex items-center justify-center gap-2 mt-2"
              >
                <Plus size={18} /> 添加监控预警
              </button>
            </form>
          </div>

          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">监控列表 & 历史</h3>
            {alerts.length === 0 ? (
              <div className="text-center text-gray-500 py-10 flex flex-col items-center gap-2">
                <Activity size={32} className="opacity-20" />
                <p className="text-sm">暂无预警记录</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {alerts.map(alert => (
                  <div 
                    key={alert.id} 
                    className={`p-3 rounded-lg border ${
                      alert.status === 'active' 
                        ? 'bg-gray-700/30 border-gray-600' 
                        : 'bg-green-900/20 border-green-800/50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{alert.symbol}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          alert.status === 'active' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
                        }`}>
                          {alert.status === 'active' ? '监控中' : '已触发'}
                        </span>
                      </div>
                      <button onClick={() => deleteAlert(alert.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="mt-2 text-sm">
                      <span className="text-gray-400">条件: </span>
                      <span className="text-gray-200">
                        {alert.condition === 'above' && <>价格 ≥ <strong className="text-white">${alert.targetPrice}</strong></>}
                        {alert.condition === 'below' && <>价格 ≤ <strong className="text-white">${alert.targetPrice}</strong></>}
                        {alert.condition === 'rsi_over' && <strong className="text-purple-400">RSI &gt; 70 (15m级别)</strong>}
                        {alert.condition === 'rsi_under' && <strong className="text-purple-400">RSI &lt; 30 (15m级别)</strong>}
                        {alert.condition === 'macd_golden' && <strong className="text-orange-400">MACD 金叉 (15m级别)</strong>}
                        {alert.condition === 'macd_death' && <strong className="text-orange-400">MACD 死叉 (15m级别)</strong>}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500 flex justify-between items-center">
                      <span>{alert.status === 'triggered' ? alert.triggeredAt : alert.createdAt}</span>
                      {alert.notifyEmail && <Mail size={12} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
      
      {/* AI 分析弹窗 */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-slide-in">
          <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex items-center justify-between bg-gray-800/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                  <Sparkles size={18} className="text-white" />
                </div>
                <h3 className="font-bold text-lg">{currentSymbol} 市场智能洞察</h3>
              </div>
              <button onClick={() => setShowAiModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              {isAiLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-4">
                  <Loader2 size={32} className="animate-spin text-purple-500" />
                  <p>Gemini 正在深度分析 {currentSymbol} 市场数据，请稍候...</p>
                </div>
              ) : (
                <div className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap text-gray-300">
                  {aiAnalysisResult}
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-700 bg-gray-900/50 flex justify-between items-center text-xs text-gray-500">
              <span>分析由 Gemini大模型生成，仅供参考，不构成投资建议。</span>
              <button onClick={() => setShowAiModal(false)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded transition-colors">
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 隐藏滚动条样式 */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 4px; }
        .animate-slide-in { animation: slideIn 0.3s ease-out forwards; }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}} />
    </div>
  );
}