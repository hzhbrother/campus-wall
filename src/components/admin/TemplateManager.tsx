'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

interface TplField {
  name: string;
  bbox: { x: number; y: number; w: number; h: number };
}

interface Tpl {
  id: string;
  name: string;
  image: string;
  fields: TplField[];
  isActive: boolean;
  createdAt: string;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function colorFor(i: number) {
  return COLORS[i % COLORS.length];
}

export default function TemplateManager() {
  const [templates, setTemplates] = useState<Tpl[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // 新建模板表单
  const [tplName, setTplName] = useState('');
  const [image, setImage] = useState<string>('');
  const [fields, setFields] = useState<TplField[]>([]);

  // 框选
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [drawing, setDrawing] = useState<{ sx: number; sy: number } | null>(null);
  const [curBox, setCurBox] = useState<TplField['bbox'] | null>(null);
  const [pendingName, setPendingName] = useState('');
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [pendingBBox, setPendingBBox] = useState<TplField['bbox'] | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await api.get('/api/admin/verification-templates');
      setTemplates(res.templates || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const imgRect = () => imgRef.current?.getBoundingClientRect();

  const toNorm = (clientX: number, clientY: number) => {
    const r = imgRect();
    if (!r) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(1, (clientX - r.left) / r.width)),
      y: Math.max(0, Math.min(1, (clientY - r.top) / r.height)),
    };
  };

  // ---- 框选: 使用 Pointer Events 统一鼠标/触摸/手写笔 ----
  const onPointerDown = (e: React.PointerEvent) => {
    if (!image) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const { x, y } = toNorm(e.clientX, e.clientY);
    setDrawing({ sx: x, sy: y });
    setCurBox({ x, y, w: 0, h: 0 });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing) return;
    const { x, y } = toNorm(e.clientX, e.clientY);
    const nx = Math.min(drawing.sx, x), ny = Math.min(drawing.sy, y);
    const nw = Math.abs(x - drawing.sx), nh = Math.abs(y - drawing.sy);
    setCurBox({ x: nx, y: ny, w: nw, h: nh });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    if (!drawing || !curBox) { setDrawing(null); setCurBox(null); return; }
    // 太小忽略
    if (curBox.w < 0.02 || curBox.h < 0.02) {
      setDrawing(null); setCurBox(null); return;
    }
    setPendingBBox(curBox);
    setPendingName(`字段${fields.length + 1}`);
    setShowNameDialog(true);
    setDrawing(null);
  };

  const confirmField = () => {
    if (!pendingBBox || !pendingName.trim()) return;
    setFields([...fields, { name: pendingName.trim(), bbox: pendingBBox }]);
    setShowNameDialog(false);
    setCurBox(null);
    setPendingBBox(null);
  };

  const removeField = (idx: number) => {
    setFields(fields.filter((_, i) => i !== idx));
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      setFields([]);
    };
    reader.readAsDataURL(f);
  };

  const resetForm = () => {
    setCreating(false); setTplName(''); setImage(''); setFields([]);
    setCurBox(null); setDrawing(null); setShowNameDialog(false);
  };

  const save = async () => {
    if (!tplName.trim()) { alert('请输入模板名称'); return; }
    if (!image) { alert('请上传样图'); return; }
    if (fields.length === 0) { alert('请至少框选一个字段'); return; }
    try {
      await api.post('/api/admin/verification-templates', { name: tplName.trim(), image, fields });
      resetForm();
      await load();
    } catch (e: any) { alert(e.message || '保存失败'); }
  };

  const activate = async (id: string) => {
    try {
      await api.post(`/api/admin/verification-templates/${id}/activate`);
      await load();
    } catch (e: any) { alert(e.message || '操作失败'); }
  };

  const remove = async (id: string) => {
    if (!confirm('确定删除该模板?')) return;
    try {
      await api.del(`/api/admin/verification-templates/${id}`);
      await load();
    } catch (e: any) { alert(e.message || '删除失败'); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">识别模板管理</h3>
          <p className="text-xs text-gray-500 mt-0.5">上传一张校园卡样图, 框选需要识别的字段, AI 将按此模板提取用户上传照片中的对应信息</p>
        </div>
        {!creating && (
          <button onClick={() => setCreating(true)} className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600">
            + 新建模板
          </button>
        )}
      </div>

      {/* 模板列表 */}
      {!creating && (
        loading ? <div className="text-sm text-gray-500">加载中...</div> :
        templates.length === 0 ? (
          <div className="text-sm text-gray-500 bg-gray-50 rounded-xl p-6 text-center">
            暂无模板, 点击右上角「新建模板」创建第一个识别模板
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <div key={t.id} className="border border-gray-200 rounded-xl p-3 flex gap-3 items-center">
                <img src={t.image} alt="" className="w-24 h-16 object-cover rounded border" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{t.name}</span>
                    {t.isActive && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">已激活</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t.fields.length} 个字段: {t.fields.map(f => f.name).join('、')}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{new Date(t.createdAt).toLocaleString('zh-CN')}</div>
                </div>
                <div className="flex gap-2">
                  {!t.isActive && (
                    <button onClick={() => activate(t.id)} className="text-xs px-2.5 py-1 bg-green-500 text-white rounded hover:bg-green-600">设为激活</button>
                  )}
                  <button onClick={() => remove(t.id)} className="text-xs px-2.5 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100">删除</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* 新建模板 */}
      {creating && (
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <input
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
              placeholder="模板名称, 如: 一中校园卡"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <label className="px-3 py-2 text-sm bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200">
              {image ? '重新上传样图' : '上传样图'}
              <input type="file" accept="image/*" onChange={onUpload} className="hidden" />
            </label>
            <button onClick={resetForm} className="px-3 py-2 text-sm text-gray-600">取消</button>
            <button onClick={save} className="px-3 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600">保存模板</button>
          </div>

          {image && (
            <div>
              <div className="text-xs text-gray-500 mb-1">在图片上按住拖动来框选字段 (支持鼠标/触摸), 松开后输入字段名称</div>
              <div
                ref={containerRef}
                className="relative inline-block select-none border border-gray-200 rounded-lg overflow-hidden"
                style={{ maxWidth: '100%' }}
              >
                <img
                  ref={imgRef}
                  src={image}
                  alt="template"
                  className="block max-h-[460px] max-w-full"
                  draggable={false}
                />
                {/* 已确认的框 */}
                {fields.map((f, i) => (
                  <div
                    key={i}
                    className="absolute border-2 flex items-start pointer-events-none"
                    style={{
                      left: `${f.bbox.x * 100}%`,
                      top: `${f.bbox.y * 100}%`,
                      width: `${f.bbox.w * 100}%`,
                      height: `${f.bbox.h * 100}%`,
                      borderColor: colorFor(i),
                    }}
                  >
                    <span
                      className="text-[10px] px-1 text-white"
                      style={{ backgroundColor: colorFor(i) }}
                    >{f.name}</span>
                    <button
                      onClick={() => removeField(i)}
                      className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center pointer-events-auto"
                      title="删除"
                    >×</button>
                  </div>
                ))}
                {/* 正在绘制的框 */}
                {curBox && (
                  <div
                    className="absolute border-2 border-dashed border-amber-500 bg-amber-500/10 pointer-events-none"
                    style={{
                      left: `${curBox.x * 100}%`,
                      top: `${curBox.y * 100}%`,
                      width: `${curBox.w * 100}%`,
                      height: `${curBox.h * 100}%`,
                    }}
                  />
                )}
                {/* 覆盖层: 捕获指针事件用于框选 (统一鼠标/触摸) */}
                <div
                  className="absolute inset-0 cursor-crosshair"
                  style={{ touchAction: 'none' }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={() => { setDrawing(null); setCurBox(null); }}
                />
              </div>

              {fields.length > 0 && (
                <div className="mt-3 text-xs text-gray-600 space-y-1">
                  {fields.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: colorFor(i) }} />
                      <span className="font-medium">{f.name}</span>
                      <span className="text-gray-400">
                        ({f.bbox.x.toFixed(2)}, {f.bbox.y.toFixed(2)}, {f.bbox.w.toFixed(2)}, {f.bbox.h.toFixed(2)})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 字段命名弹窗 */}
      {showNameDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNameDialog(false)}>
          <div className="bg-white rounded-xl p-4 w-72" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-medium mb-2">字段名称</div>
            <input
              autoFocus
              value={pendingName}
              onChange={(e) => setPendingName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmField(); }}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="如: 姓名 / 学号 / 班级"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={() => { setShowNameDialog(false); setCurBox(null); }} className="px-3 py-1.5 text-sm text-gray-600">取消</button>
              <button onClick={confirmField} className="px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600">确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
