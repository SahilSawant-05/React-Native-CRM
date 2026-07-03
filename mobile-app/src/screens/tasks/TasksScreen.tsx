import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../api/client";

const HFONT = Platform.OS === "android" ? "sans-serif-medium" : undefined;
const LS16 = Platform.OS === "ios" ? -0.32 : 0;
const LS14 = Platform.OS === "ios" ? -0.15 : 0;
import { Contact, Task, User } from "../../types";

type StatusKey = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

interface TaskCard extends Task {
  key: string;
  contactId?: number | string;
  contactName?: string;
  contactPhone?: string;
  assignedUserEmail?: string;
  createdByUserEmail?: string;
  tags: string[];
  date: string;
  status: StatusKey;
  priority: string;
}

interface KanbanColumn { id: StatusKey; name: string; cards: TaskCard[] }
interface FormState { title: string; description: string; priority: string; assignedUserId: string; tags: string[]; date: string; colId: StatusKey }

const STATUS_COLUMNS: { id: StatusKey; name: string }[] = [
  { id: "OPEN", name: "Open" }, { id: "IN_PROGRESS", name: "In Progress" },
  { id: "COMPLETED", name: "Completed" }, { id: "CANCELLED", name: "Cancelled" },
];

const STATUS_MAP: Record<string, StatusKey> = {
  OPEN: "OPEN", IN_PROGRESS: "IN_PROGRESS", COMPLETED: "COMPLETED", CANCELLED: "CANCELLED",
  TO_DO: "OPEN", TODO: "OPEN", DONE: "COMPLETED", REVIEW: "IN_PROGRESS",
};

const COLUMN_COLORS: Record<StatusKey, string> = {
  OPEN: "#3b82f6", IN_PROGRESS: "#f59e0b", COMPLETED: "#10b981", CANCELLED: "#ef4444",
};

const PRIORITY_META: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  high:   { label: "High",   bg: "#fef2f2", text: "#b91c1c", dot: "#ef4444" },
  medium: { label: "Medium", bg: "#fffbeb", text: "#92400e", dot: "#f59e0b" },
  low:    { label: "Low",    bg: "#f0fdf4", text: "#166534", dot: "#10b981" },
};

const TAGS = ["Admin","Layout","Dashboard","Design","Website","Marketing","Business","Logo","UI/UX","Analysis","Product","Ecommerce","Graphic"];

let _seq = 100;
const uid = (): string => `local-${++_seq}`;
const normalizeStatus = (v: unknown): StatusKey => STATUS_MAP[String(v ?? "OPEN").trim().toUpperCase().replaceAll(" ", "_")] ?? "OPEN";
const safeId = (v: number | string | undefined): string => v != null ? String(v) : uid();
const toDueAt = (date: string): string | null => !date ? null : date.includes("T") ? new Date(date).toISOString() : `${date}T09:00:00+05:30`;

const displayDate = (v?: string): string => {
  if (!v) return "No date";
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

const dueMeta = (date?: string): { label: string; color: string } => {
  if (!date) return { label: "No Date", color: "#94a3b8" };
  const due = new Date(`${date.split("T")[0]}T23:59:59`);
  if (isNaN(due.getTime())) return { label: date, color: "#94a3b8" };
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
  const dueDay = new Date(due); dueDay.setHours(0,0,0,0);
  if (dueDay < today) return { label: "Overdue", color: "#ef4444" };
  if (dueDay.getTime() === today.getTime()) return { label: "Today", color: "#3b82f6" };
  if (dueDay.getTime() === tomorrow.getTime()) return { label: "Tomorrow", color: "#f59e0b" };
  return { label: "Upcoming", color: "#10b981" };
};

const normalizeTaskList = (raw: unknown): Task[] => {
  if (Array.isArray(raw)) return raw as Task[];
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    for (const k of ["data","tasks","items","content"]) if (Array.isArray(r[k])) return r[k] as Task[];
    if ((raw as Task).title != null) return [raw as Task];
  }
  return [];
};

const taskToCard = (t: Task & Record<string, unknown>): TaskCard => ({
  ...t,
  key: safeId(t.id ?? t._id), id: t.id ?? t._id,
  contactId: t.contactId as any, contactName: t.contactName as any,
  contactPhone: t.contactPhone as any,
  assignedUserEmail: (t.assignedUserEmail as any) ?? (t.assignedTo as any),
  createdByUserEmail: t.createdByUserEmail as any,
  title: t.title || "Untitled", description: t.description,
  priority: (t.priority ?? "medium").toLowerCase(),
  tags: Array.isArray(t.tags) ? t.tags as string[] : [],
  date: t.dueAt ? t.dueAt.slice(0, 16) : "", dueAt: t.dueAt,
  status: normalizeStatus(t.status),
});

const toColumns = (tasks: Task[]): KanbanColumn[] => {
  const map = new Map<StatusKey, TaskCard[]>();
  STATUS_COLUMNS.forEach(({ id }) => map.set(id, []));
  tasks.forEach((t) => { const c = taskToCard(t as any); map.get(c.status)!.push(c); });
  return STATUS_COLUMNS.map(({ id, name }) => ({ id, name, cards: map.get(id)! }));
};

const EMPTY_COLS: KanbanColumn[] = STATUS_COLUMNS.map(({ id, name }) => ({ id, name, cards: [] }));

const taskApi = {
  getContacts: async (): Promise<Contact[]> => {
    try { const r = await api.get("/api/contacts/page", { params: { page: 0, size: 200 } }); return r.data?.items ?? []; }
    catch { const r = await api.get("/api/contacts"); return Array.isArray(r.data) ? r.data : (r.data?.data ?? r.data?.contacts ?? []); }
  },
  getTasks:     (cid: any) => api.get(`/api/contacts/${cid}/tasks`).then(r => r.data),
  createTask:   (cid: any, data: object) => api.post(`/api/contacts/${cid}/tasks`, data).then(r => r.data as Task),
  updateTask:   (cid: any, tid: any, data: object) => api.put(`/api/contacts/${cid}/tasks/${tid}`, data).then(r => r.data as Task),
  deleteTask:   (cid: any, tid: any) => api.delete(`/api/contacts/${cid}/tasks/${tid}`).then(() => true),
  updateStatus: (cid: any, tid: any, status: string) => api.post(`/api/contacts/${cid}/tasks/${tid}/status`, { status }).then(r => r.data as Task),
  getMyTasks:   () => api.get("/api/tasks/my-tasks").then(r => r.data),
  getTeamTasks: () => api.get("/api/tasks/team").then(r => r.data),
  getToday:     () => api.get("/api/tasks/today").then(r => r.data),
  getOverdue:   () => api.get("/api/tasks/overdue").then(r => r.data),
  getUsers:     () => api.get("/api/users").then(r => r.data),
};

type ToastType = "success" | "error" | "info";

function Toast({ msg, type, onDone }: { msg: string; type: ToastType; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  const clr = { success: { bg:"#dcfce7", text:"#166534" }, error: { bg:"#fee2e2", text:"#991b1b" }, info: { bg:"#dbeafe", text:"#1e40af" } }[type];
  const icon = type==="success"?"checkmark-circle":type==="error"?"alert-circle-outline":"information-circle-outline";
  return <View style={[s.toast,{backgroundColor:clr.bg}]}><Ionicons name={icon as any} size={16} color={clr.text} style={{marginRight:8}}/><Text style={{color:clr.text,fontWeight:"600",fontSize:13,fontFamily:HFONT,letterSpacing:LS14}}>{msg}</Text></View>;
}

/* ─── Move-to-Column Sheet ── */
function MoveSheet({ card, visible, onClose, onMove }: { card: TaskCard|null; visible: boolean; onClose:()=>void; onMove:(c:TaskCard,to:StatusKey)=>void }) {
  if (!card) return null;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.sheetBackdrop} activeOpacity={1} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.sheetHandle} />
        <Text style={s.sheetTitle}>Move "{card.title}"</Text>
        <Text style={s.sheetSub}>Select destination column</Text>
        {STATUS_COLUMNS.map(({ id, name }) => {
          const active = card.status === id;
          const color = COLUMN_COLORS[id];
          return (
            <TouchableOpacity key={id} style={[s.sheetRow, active && { backgroundColor: color+"18" }]} onPress={() => { onMove(card, id); onClose(); }} disabled={active}>
              <View style={[s.sheetDot, { backgroundColor: color }]} />
              <Text style={[s.sheetRowText, { color: active ? color : "#0f172a" }]}>{name}</Text>
              {active && <Text style={[s.sheetCurrent, { color }]}>current</Text>}
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={s.sheetCancel} onPress={onClose}><Text style={s.sheetCancelText}>Cancel</Text></TouchableOpacity>
      </View>
    </Modal>
  );
}

/* ─── Drag-to-reorder within a column ── */
function DraggableList({ data, onReorder, renderItem, emptyComponent }: {
  data: TaskCard[]; onReorder:(d:TaskCard[])=>void;
  renderItem:(item:TaskCard, dragging:boolean)=>React.ReactNode;
  emptyComponent: React.ReactNode;
}) {
  const [draggingKey, setDraggingKey] = useState<string|null>(null);
  const [hoverIdx, setHoverIdx]       = useState<number|null>(null);
  const fromIdx = useRef(-1);

  if (data.length === 0) return <>{emptyComponent}</>;

  const commit = (toIdx: number) => {
    if (draggingKey === null) return;
    if (fromIdx.current !== toIdx) {
      const next = [...data];
      const [moved] = next.splice(fromIdx.current, 1);
      next.splice(toIdx, 0, moved);
      onReorder(next);
    }
    setDraggingKey(null); setHoverIdx(null);
  };

  return (
    <>
      {data.map((item, idx) => {
        const dragging = item.key === draggingKey;
        const hover    = hoverIdx === idx && draggingKey !== null && !dragging;
        return (
          <TouchableOpacity
            key={item.key}
            activeOpacity={dragging ? 0.4 : 1}
            style={[dragging && s.draggingCard, hover && s.hoverTarget]}
            onLongPress={() => { fromIdx.current = idx; setDraggingKey(item.key); setHoverIdx(idx); }}
            onPress={() => { if (draggingKey) commit(idx); }}
            delayLongPress={250}
          >
            {renderItem(item, dragging)}
          </TouchableOpacity>
        );
      })}
      {draggingKey !== null && (
        <TouchableOpacity style={s.dropZone} onPress={() => commit(data.length)} activeOpacity={0.6}>
          <Ionicons name="arrow-down-circle-outline" size={14} color="#0f766e" style={{marginRight:6}}/>
          <Text style={s.dropZoneText}>Drop here (end of list)</Text>
        </TouchableOpacity>
      )}
    </>
  );
}

/* ─── Contact Picker ── */
function ContactPickerModal({ visible, onClose, onSelect }: { visible:boolean; onClose:()=>void; onSelect:(c:Contact)=>void }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading]   = useState(false);
  const [query, setQuery]       = useState("");
  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    taskApi.getContacts().then(setContacts).catch(()=>setContacts([])).finally(()=>setLoading(false));
  }, [visible]);
  const filtered = contacts.filter(c => { const q=query.toLowerCase(); return c.name?.toLowerCase().includes(q)||c.email?.toLowerCase().includes(q)||c.phone?.toLowerCase().includes(q); });
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{flex:1,backgroundColor:"#fff"}}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>Select Contact</Text>
          <TouchableOpacity onPress={onClose} style={s.modalClose}><Ionicons name="close" size={20} color="#6b7280"/></TouchableOpacity>
        </View>
        <View style={{paddingHorizontal:16,paddingBottom:8}}>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search contacts…" placeholderTextColor="#94a3b8" style={s.searchInput} />
        </View>
        {loading ? <View style={s.center}><ActivityIndicator color="#0f766e"/></View>
          : filtered.length===0 ? <View style={s.center}><Text style={{color:"#94a3b8"}}>No contacts found</Text></View>
          : <ScrollView contentContainerStyle={{paddingHorizontal:16}}>
              {filtered.map(c => {
                const cid = safeId(c.id??c._id);
                return (
                  <TouchableOpacity key={cid} style={s.contactRow} onPress={()=>{onSelect(c);onClose();}}>
                    <View style={s.avatar}><Text style={s.avatarText}>{c.name.split(" ").slice(0,2).map((w:string)=>w[0]?.toUpperCase()).join("")}</Text></View>
                    <View style={{flex:1}}><Text style={s.contactName}>{c.name}</Text><Text style={s.contactSub}>{c.email??c.phone??`ID: ${cid}`}</Text></View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>}
      </SafeAreaView>
    </Modal>
  );
}

/* ─── Task Form ── */
function TaskFormModal({ visible, onClose, onSave, initial, colId, columns, users, loading }: {
  visible:boolean; onClose:()=>void; onSave:(d:FormState&{cardKey:string})=>void;
  initial:TaskCard|null; colId:StatusKey; columns:KanbanColumn[]; users:User[]; loading:boolean;
}) {
  const blank: FormState = { title:"", description:"", priority:"medium", assignedUserId:"", tags:[], date:"", colId };
  const [form, setForm]     = useState<FormState>(blank);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState,string>>>({});

  useEffect(() => {
    if (!visible) return;
    setForm(initial ? { title:initial.title, description:initial.description??"", priority:initial.priority, assignedUserId:String(initial.assignedUserEmail??""), tags:initial.tags, date:initial.date, colId:initial.status } : { ...blank, colId });
    setErrors({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const set = <K extends keyof FormState>(k:K, v:FormState[K]) => setForm(f=>({...f,[k]:v}));
  const toggleTag = (t:string) => set("tags", form.tags.includes(t)?form.tags.filter(x=>x!==t):[...form.tags,t]);

  const submit = () => {
    const e: any = {};
    if (!form.title.trim()) e.title = "Task name is required";
    if (!form.description.trim()) e.description = "Description is required";
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave({ ...form, cardKey: initial?.key ?? uid() }); onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{flex:1,backgroundColor:"#fff"}}>
        <View style={s.modalHeader}>
          <Text style={s.modalTitle}>{initial?"Edit Task":"New Task"}</Text>
          <TouchableOpacity onPress={onClose} style={s.modalClose}><Ionicons name="close" size={20} color="#6b7280"/></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{padding:16}} keyboardShouldPersistTaps="handled">
          <Text style={s.fieldLabel}>TASK NAME *</Text>
          <TextInput value={form.title} onChangeText={v=>{set("title",v);setErrors(e=>({...e,title:undefined}));}} placeholder="Enter task name…" placeholderTextColor="#94a3b8" style={[s.input,errors.title?s.inputError:null]} />
          {!!errors.title && <Text style={s.errorText}>{errors.title}</Text>}

          <Text style={[s.fieldLabel,{marginTop:12}]}>DESCRIPTION *</Text>
          <TextInput value={form.description} onChangeText={v=>{set("description",v);setErrors(e=>({...e,description:undefined}));}} placeholder="What needs to be done?" placeholderTextColor="#94a3b8" multiline numberOfLines={3} style={[s.input,{height:80,textAlignVertical:"top"},errors.description?s.inputError:null]} />
          {!!errors.description && <Text style={s.errorText}>{errors.description}</Text>}

          <Text style={[s.fieldLabel,{marginTop:12}]}>PRIORITY</Text>
          <View style={{flexDirection:"row",gap:8}}>
            {(["low","medium","high"] as const).map(p => {
              const meta=PRIORITY_META[p]; const active=form.priority===p;
              return <TouchableOpacity key={p} onPress={()=>set("priority",p)} style={[s.priorityBtn,{backgroundColor:active?meta.bg:"rgba(118,118,128,0.08)"}]}><View style={[s.dot,{backgroundColor:meta.dot}]}/><Text style={{fontSize:13,fontWeight:"600",fontFamily:HFONT,letterSpacing:LS14,color:active?meta.text:"#6b7280"}}>{meta.label}</Text></TouchableOpacity>;
            })}
          </View>

          <Text style={[s.fieldLabel,{marginTop:12}]}>COLUMN</Text>
          <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>
            {columns.map(col => {
              const active=form.colId===col.id; const color=COLUMN_COLORS[col.id];
              return <TouchableOpacity key={col.id} onPress={()=>set("colId",col.id)} style={[s.chip,{backgroundColor:active?color+"18":"rgba(118,118,128,0.08)"}]}><Text style={{fontSize:13,fontWeight:"600",fontFamily:HFONT,letterSpacing:LS14,color:active?color:"#6b7280"}}>{col.name}</Text></TouchableOpacity>;
            })}
          </View>

          {users.length>0 && (<>
            <Text style={[s.fieldLabel,{marginTop:12}]}>ASSIGN TO</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {[{id:"",email:"Unassigned",role:"AGENT" as const,tenantId:""},...users].map((u,i) => {
                const active=form.assignedUserId===String(u.id);
                return <TouchableOpacity key={u.id===""?"unassigned":String(u.id)} onPress={()=>set("assignedUserId",String(u.id))} style={[s.chip,{marginLeft:i===0?0:8,backgroundColor:active?"#0f766e":"rgba(118,118,128,0.08)"}]}><Text style={{fontSize:13,color:active?"#fff":"#6b7280",fontWeight:"600",fontFamily:HFONT,letterSpacing:LS14}}>{u.email}</Text></TouchableOpacity>;
              })}
            </ScrollView>
          </>)}

          <Text style={[s.fieldLabel,{marginTop:12}]}>TAGS</Text>
          <View style={{flexDirection:"row",flexWrap:"wrap",gap:6}}>
            {TAGS.map(t => {
              const active=form.tags.includes(t);
              return <TouchableOpacity key={t} onPress={()=>toggleTag(t)} style={[s.tagChip,{backgroundColor:active?"#0f766e":"rgba(118,118,128,0.08)",flexDirection:"row",alignItems:"center"}]}>{active&&<Ionicons name="checkmark" size={12} color="#fff" style={{marginRight:3}}/>}<Text style={{fontSize:12,color:active?"#fff":"#6b7280",fontWeight:"600",fontFamily:HFONT}}>{t}</Text></TouchableOpacity>;
            })}
          </View>

          <TouchableOpacity onPress={submit} disabled={loading} style={[s.saveBtn,loading&&{opacity:0.6}]}>
            <Text style={s.saveBtnText}>{loading?"Saving…":initial?"Update Task":"Create Task"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* ─── Task Card ── */
function TaskCardView({ card, isDragging, onEdit, onDelete, onMove }: {
  card:TaskCard; isDragging:boolean; onEdit:()=>void; onDelete:()=>void; onMove:()=>void;
}) {
  const pri = PRIORITY_META[card.priority] ?? PRIORITY_META.medium;
  const due = dueMeta(card.date || card.dueAt);
  const confirmDelete = () => Alert.alert("Delete Task", `Delete "${card.title}"?`, [{ text:"Cancel",style:"cancel" },{ text:"Delete",style:"destructive",onPress:onDelete }]);
  return (
    <View style={[s.card, isDragging&&s.cardActive]}>
      <View style={s.cardHeader}>
        <Ionicons name="reorder-three-outline" size={16} color="#9ca3af"/>
        <Text style={s.cardId}>#{safeId(card.id??card._id).slice(-4)}</Text>
        <View style={{flex:1}}/>
        <TouchableOpacity onPress={onMove} style={s.cardAction}><Ionicons name="swap-horizontal-outline" size={15} color="#6b7280"/></TouchableOpacity>
        <TouchableOpacity onPress={onEdit} style={[s.cardAction,{marginLeft:4}]}><Ionicons name="pencil-outline" size={14} color="#6b7280"/></TouchableOpacity>
        <TouchableOpacity onPress={confirmDelete} style={[s.cardAction,{marginLeft:4}]}><Ionicons name="trash-outline" size={14} color="#b91c1c"/></TouchableOpacity>
      </View>
      <Text style={s.cardTitle} numberOfLines={2}>{card.title}</Text>
      <View style={s.infoChip}>
        <InfoRow label="Contact"  value={card.contactName??`#${card.contactId??"—"}`}/>
        {!!card.contactPhone && <InfoRow label="Phone" value={card.contactPhone}/>}
        <InfoRow label="Assigned" value={card.assignedUserEmail??(card.assignedTo as any)??"Unassigned"}/>
      </View>
      {!!card.description && <Text style={s.cardDesc} numberOfLines={2}>{card.description}</Text>}
      {card.tags.length>0 && (
        <View style={s.tagsRow}>
          {card.tags.slice(0,3).map(t=><View key={t} style={s.tagBadge}><Text style={s.tagBadgeText}>{t}</Text></View>)}
          {card.tags.length>3 && <Text style={s.tagMore}>+{card.tags.length-3}</Text>}
        </View>
      )}
      <View style={s.cardFooter}>
        <View style={[s.priBadge,{backgroundColor:pri.bg}]}><View style={[s.dot,{backgroundColor:pri.dot}]}/><Text style={[s.priBadgeText,{color:pri.text}]}>{pri.label}</Text></View>
        <View style={{flex:1}}/>
        <Text style={[s.dueLabel,{color:due.color}]}>{due.label}</Text>
      </View>
      <View style={{flexDirection:"row",alignItems:"center",gap:4}}><Ionicons name="calendar-outline" size={11} color="#9ca3af"/><Text style={s.dateText}>{displayDate(card.dueAt??card.date)}</Text></View>
    </View>
  );
}

function InfoRow({ label, value }: { label:string; value:string }) {
  return <View style={s.infoRow}><Text style={s.infoLabel}>{label}</Text><Text style={s.infoValue} numberOfLines={1}>{value}</Text></View>;
}

/* ─── Kanban Column ── */
function KanbanColumnView({ col, onAddCard, onEditCard, onDeleteCard, onReorder, onMoveCard }: {
  col:KanbanColumn; onAddCard:(id:StatusKey)=>void; onEditCard:(c:TaskCard)=>void;
  onDeleteCard:(c:TaskCard)=>void; onReorder:(id:StatusKey,d:TaskCard[])=>void; onMoveCard:(c:TaskCard)=>void;
}) {
  const accent = COLUMN_COLORS[col.id];
  return (
    <View style={[s.column,{borderTopColor:accent}]}>
      <View style={s.columnHeader}>
        <View style={[s.dot,{backgroundColor:accent,width:8,height:8}]}/>
        <Text style={s.colName}>{col.name}</Text>
        <View style={[s.colCount,{backgroundColor:accent+"22"}]}><Text style={[s.colCountText,{color:accent}]}>{col.cards.length}</Text></View>
      </View>
      <DraggableList
        data={col.cards}
        onReorder={d=>onReorder(col.id,d)}
        renderItem={(item,dragging)=>(
          <TaskCardView card={item} isDragging={dragging} onEdit={()=>onEditCard(item)} onDelete={()=>onDeleteCard(item)} onMove={()=>onMoveCard(item)}/>
        )}
        emptyComponent={<View style={s.emptyCol}><Text style={s.emptyColText}>No tasks · long-press to reorder</Text></View>}
      />
      <TouchableOpacity onPress={()=>onAddCard(col.id)} style={[s.addMoreBtn,{borderColor:accent+"60"}]}>
        <Ionicons name="add" size={15} color={accent}/><Text style={[s.addMoreText,{color:accent,marginLeft:4}]}>Add Task</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ─── Filters ── */
const FILTERS = [
  { key:"team",     label:"Team",    icon:"people-outline",       color:"#0f766e" },
  { key:"my-tasks", label:"Mine",    icon:"person-outline",       color:"#0f766e" },
  { key:"today",    label:"Today",   icon:"calendar-outline",     color:"#0f766e" },
  { key:"overdue",  label:"Overdue", icon:"alert-circle-outline", color:"#0f766e" },
] as const;
type FilterKey = typeof FILTERS[number]["key"];

function FilterPills({ active, loading, onSelect }: { active:FilterKey|null; loading:boolean; onSelect:(f:FilterKey)=>void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar} contentContainerStyle={{gap:8,alignItems:"center" as const}}>
      {FILTERS.map(({key,label,icon,color})=>{
        const on=active===key;
        return (
          <TouchableOpacity key={key} onPress={()=>onSelect(key)} style={[s.filterPill,{backgroundColor:on?color:"rgba(118,118,128,0.08)"}]}>
            <Ionicons name={(loading&&on?"sync-outline":icon) as any} size={14} color={on?"#fff":"#6b7280"}/>
            <Text style={{fontSize:13,fontWeight:"600",fontFamily:HFONT,letterSpacing:LS14,color:on?"#fff":"#6b7280",marginLeft:5}}>{label}</Text>
            {on&&<Ionicons name="close" size={12} color="#fff" style={{marginLeft:4}}/>}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/* ─── Main Screen ── */
export default function TaskKanbanScreen() {
  const [columns, setColumns]             = useState<KanbanColumn[]>(EMPTY_COLS);
  const [contactId, setContactId]         = useState<string|null>(null);
  const [contactName, setContactName]     = useState<string|null>(null);
  const [users, setUsers]                 = useState<User[]>([]);
  const [search, setSearch]               = useState("");
  const [apiLoading, setApiLoading]       = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [activeFilter, setActiveFilter]   = useState<FilterKey|null>(null);
  const [taskSaving, setTaskSaving]       = useState(false);
  const [contactModal, setContactModal]   = useState(false);
  const [taskFormModal, setTaskFormModal] = useState(false);
  const [moveSheet, setMoveSheet]         = useState(false);
  const [editCard, setEditCard]           = useState<TaskCard|null>(null);
  const [moveCard, setMoveCard]           = useState<TaskCard|null>(null);
  const [activeColId, setActiveColId]     = useState<StatusKey>("OPEN");
  const [toast, setToast]                 = useState<{msg:string;type:ToastType}|null>(null);

  const showToast = useCallback((msg:string, type:ToastType="success") => setToast({msg,type}), []);

  useEffect(() => { taskApi.getUsers().then(raw=>setUsers(normalizeTaskList(raw) as any)).catch(()=>setUsers([])); }, []);
  useEffect(() => { fetchFilter("team"); }, []); // eslint-disable-line

  const loadContactTasks = useCallback((cid:string, label:string) => {
    setApiLoading(true);
    taskApi.getTasks(cid)
      .then(raw=>{ const tasks=normalizeTaskList(raw); setColumns(tasks.length?toColumns(tasks):EMPTY_COLS); showToast(tasks.length?`Loaded ${tasks.length} task(s) for ${label}`:`No tasks for ${label}`,tasks.length?"success":"info"); })
      .catch((err:Error)=>{ showToast(`Failed: ${err.message}`,"error"); setColumns(EMPTY_COLS); })
      .finally(()=>setApiLoading(false));
  }, [showToast]);

  const fetchFilter = async (filter: FilterKey) => {
    if (activeFilter===filter) { setActiveFilter(null); if (contactId) loadContactTasks(contactId,contactName??""); return; }
    setActiveFilter(filter); setFilterLoading(true);
    try {
      const raw = filter==="today"?await taskApi.getToday():filter==="overdue"?await taskApi.getOverdue():filter==="team"?await taskApi.getTeamTasks():await taskApi.getMyTasks();
      const tasks=normalizeTaskList(raw); setColumns(tasks.length?toColumns(tasks):EMPTY_COLS);
      showToast(tasks.length?`Loaded ${tasks.length} task(s)`:`No tasks for "${filter}"`,tasks.length?"success":"info");
    } catch (err:any) { showToast(`Filter failed: ${err.message}`,"error"); } finally { setFilterLoading(false); }
  };

  const handleSelectContact = (c: Contact) => {
    const id=safeId(c.id??c._id); setContactId(id); setContactName(c.name); setActiveFilter(null); loadContactTasks(id,c.name);
  };

  const handleReorder = useCallback((colId:StatusKey, newCards:TaskCard[]) => {
    setColumns(prev=>prev.map(col=>col.id===colId?{...col,cards:newCards}:col));
  }, []);

  const handleMoveCard = async (card:TaskCard, toCol:StatusKey) => {
    if (card.status===toCol) return;
    const cid=card.contactId??contactId; const tid=card.id??card._id;
    if (!cid||tid==null) { showToast("Cannot move: missing id","error"); return; }
    try {
      await taskApi.updateStatus(cid,tid,toCol);
      setColumns(prev=>prev.map(col=>{
        if (col.id===card.status) return {...col,cards:col.cards.filter(c=>c.key!==card.key)};
        if (col.id===toCol)       return {...col,cards:[...col.cards,{...card,status:toCol}]};
        return col;
      }));
      showToast(`Moved to ${STATUS_COLUMNS.find(c=>c.id===toCol)?.name}`);
    } catch (err:any) { showToast(`Move failed: ${err.message}`,"error"); }
  };

  const openAdd  = (colId:StatusKey) => { if (!contactId){showToast("Select a contact first","info");setContactModal(true);return;} setEditCard(null);setActiveColId(colId);setTaskFormModal(true); };
  const openEdit = (card:TaskCard)   => { setEditCard(card);setActiveColId(card.status);setTaskFormModal(true); };
  const openMove = (card:TaskCard)   => { setMoveCard(card);setMoveSheet(true); };

  const saveCard = async (data: FormState & { cardKey:string }) => {
    const status=data.colId; const effectiveCid=editCard?.contactId??contactId;
    if (!effectiveCid){showToast("Select a contact before saving","error");return;}
    const payload={title:data.title,description:data.description,assignedUserId:data.assignedUserId?Number(data.assignedUserId):null,dueAt:toDueAt(data.date)};
    setTaskSaving(true);
    try {
      if (editCard) {
        const tid=editCard.id??editCard._id; if (tid==null) throw new Error("Task has no id");
        const updated=await taskApi.updateTask(effectiveCid,tid,payload);
        if (status!==editCard.status) await taskApi.updateStatus(effectiveCid,tid,status);
        const merged:TaskCard={...editCard,title:data.title,description:data.description,priority:data.priority,tags:data.tags,date:data.date,dueAt:(updated as Task).dueAt??editCard.dueAt,status};
        setColumns(prev=>prev.map(col=>{const without=col.cards.filter(c=>c.key!==editCard.key);return col.id===status?{...col,cards:[...without,merged]}:{...col,cards:without};}));
        showToast("Task updated");
      } else {
        const created=await taskApi.createTask(effectiveCid,payload); const ct=created as any;
        if (status!=="OPEN"&&(ct.id??ct._id)!=null) await taskApi.updateStatus(effectiveCid,ct.id??ct._id,status);
        const newCard:TaskCard={...taskToCard(ct),key:safeId(ct.id??ct._id),priority:data.priority,tags:data.tags,date:data.date,status,contactId:String(effectiveCid),contactName:contactName??undefined};
        setColumns(prev=>prev.map(col=>col.id===status?{...col,cards:[...col.cards,newCard]}:col));
        showToast("Task created");
      }
    } catch (err:any){showToast(`Save failed: ${err.message}`,"error");}
    finally{setTaskSaving(false);}
  };

  const handleDelete = async (card:TaskCard) => {
    const cid=card.contactId??contactId; const tid=card.id??card._id;
    if (!cid||tid==null){showToast("Cannot delete: missing id","error");return;}
    try { await taskApi.deleteTask(cid,tid); setColumns(prev=>prev.map(col=>({...col,cards:col.cards.filter(c=>c.key!==card.key)}))); showToast("Task deleted"); }
    catch (err:any){showToast(`Delete failed: ${err.message}`,"error");}
  };

  const filteredCols = columns.map(col=>({...col,cards:search?col.cards.filter(c=>{const q=search.toLowerCase();return c.title.toLowerCase().includes(q)||c.description?.toLowerCase().includes(q)||c.contactName?.toLowerCase().includes(q)||c.assignedUserEmail?.toLowerCase().includes(q);}):col.cards}));
  const total = columns.reduce((acc,col)=>acc+col.cards.length,0);

  return (
    <SafeAreaView style={s.root} edges={["bottom"]}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <View style={s.logoBox}><Ionicons name="checkmark-done-outline" size={17} color="#fff"/></View>
          <View><Text style={s.headerTitle}>TaskBoard</Text><Text style={s.headerSub}>{apiLoading?"Loading…":`${total} task${total!==1?"s":""} · ${columns.length} cols`}</Text></View>
        </View>
        <TouchableOpacity onPress={()=>setContactModal(true)} style={[s.contactBtn,contactId&&{borderColor:"#0f766e",backgroundColor:"#f0fdfa"}]}>
          <Ionicons name="person-circle-outline" size={16} color={contactId?"#0f766e":"#9ca3af"}/>
          <Text style={[s.contactBtnText,contactId?{color:"#0f766e"}:null]} numberOfLines={1}>{contactName??"Select Contact"}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.searchBar}>
        <Ionicons name="search-outline" size={16} color="#9ca3af" style={{marginRight:6}}/>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search tasks…" placeholderTextColor="#9ca3af" style={s.searchBarInput}/>
        {!!search && <TouchableOpacity onPress={()=>setSearch("")} hitSlop={{top:10,bottom:10,left:10,right:10}}><Ionicons name="close-circle" size={16} color="#9ca3af"/></TouchableOpacity>}
      </View>

      {(apiLoading||filterLoading) && <View style={{alignItems:"center",paddingVertical:4}}><ActivityIndicator size="small" color="#0f766e"/></View>}

      <FilterPills active={activeFilter} loading={filterLoading} onSelect={fetchFilter}/>

      {!contactId&&!activeFilter&&!apiLoading ? (
        <View style={s.emptyState}>
          <View style={s.emptyStateIconWrap}><Ionicons name="clipboard-outline" size={34} color="#0f766e"/></View>
          <Text style={s.emptyStateTitle}>Select a Contact</Text>
          <Text style={s.emptyStateSub}>Pick a contact or use a filter above to load tasks</Text>
          <TouchableOpacity onPress={()=>setContactModal(true)} style={s.cta}><Text style={s.ctaText}>Choose Contact</Text><Ionicons name="arrow-forward" size={15} color="#fff" style={{marginLeft:6}}/></TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={{flex:1}}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.board}>
            {filteredCols.map(col=>(
              <KanbanColumnView key={col.id} col={col} onAddCard={openAdd} onEditCard={openEdit} onDeleteCard={handleDelete} onReorder={handleReorder} onMoveCard={openMove}/>
            ))}
          </ScrollView>
        </ScrollView>
      )}

      <ContactPickerModal visible={contactModal} onClose={()=>setContactModal(false)} onSelect={handleSelectContact}/>
      <TaskFormModal visible={taskFormModal} onClose={()=>setTaskFormModal(false)} onSave={saveCard} initial={editCard} colId={activeColId} columns={columns} users={users} loading={taskSaving}/>
      <MoveSheet card={moveCard} visible={moveSheet} onClose={()=>setMoveSheet(false)} onMove={handleMoveCard}/>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex:1, backgroundColor:"#f1f5f9" },
  header: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:16, paddingVertical:12, backgroundColor:"#0f172a" },
  headerLeft: { flexDirection:"row", alignItems:"center", gap:10 },
  logoBox: { width:34, height:34, borderRadius:10, backgroundColor:"#0f766e", alignItems:"center", justifyContent:"center" },
  headerTitle: { color:"#fff", fontWeight:"800", fontSize:18, letterSpacing:-0.5 },
  headerSub: { color:"#64748b", fontSize:11, marginTop:1 },
  contactBtn: { flexDirection:"row", alignItems:"center", gap:6, paddingHorizontal:10, paddingVertical:6, borderRadius:8, borderWidth:1, borderColor:"#334155", backgroundColor:"#1e293b", maxWidth:160 },
  contactBtnText: { color:"#94a3b8", fontSize:12, fontWeight:"600" },
  searchBar: { flexDirection:"row", alignItems:"center", marginHorizontal:16, marginTop:10, marginBottom:4, backgroundColor:"#fff", borderRadius:10, borderWidth:1, borderColor:"#e2e8f0", paddingHorizontal:12, paddingVertical:8 },
  searchBarInput: { flex:1, fontSize:13, color:"#0f172a" },
  filterBar: { paddingHorizontal:16, paddingVertical:8, flexGrow:0 },
  filterPill: { flexDirection:"row", alignItems:"center", paddingHorizontal:12, paddingVertical:6, borderRadius:99, borderWidth:1 },
  board: { padding:16, gap:12, alignItems:"flex-start" as const },
  column: { width:280, backgroundColor:"#fff", borderRadius:16, padding:12, borderTopWidth:3, ...Platform.select({ ios:{shadowColor:"#000",shadowOpacity:0.06,shadowOffset:{width:0,height:2},shadowRadius:8}, android:{elevation:2} }) },
  columnHeader: { flexDirection:"row", alignItems:"center", marginBottom:10, gap:6 },
  colName: { fontSize:11, fontWeight:"800", color:"#0f172a", textTransform:"uppercase", letterSpacing:1, flex:1 },
  colCount: { minWidth:20, height:20, borderRadius:10, alignItems:"center", justifyContent:"center", paddingHorizontal:4 },
  colCountText: { fontSize:10, fontWeight:"800" },
  emptyCol: { padding:20, alignItems:"center", borderRadius:10, borderWidth:1, borderStyle:"dashed", borderColor:"#e2e8f0", marginVertical:4 },
  emptyColText: { color:"#cbd5e1", fontSize:12 },
  addMoreBtn: { marginTop:8, paddingVertical:10, borderRadius:10, borderWidth:1.5, borderStyle:"dashed", alignItems:"center" },
  addMoreText: { fontSize:12, fontWeight:"700" },
  draggingCard: { opacity:0.4, transform:[{scale:0.97}] },
  hoverTarget: { borderTopWidth:2, borderTopColor:"#0f766e" },
  dropZone: { marginVertical:4, paddingVertical:12, borderRadius:10, borderWidth:1.5, borderStyle:"dashed", borderColor:"#0f766e", backgroundColor:"#f0fdfa", alignItems:"center" },
  dropZoneText: { color:"#0f766e", fontSize:12, fontWeight:"700" },
  card: { backgroundColor:"#f8fafc", borderRadius:12, padding:12, marginVertical:4, borderWidth:1, borderColor:"#e2e8f0", borderLeftWidth:3 },
  cardActive: { borderColor:"#0f766e", backgroundColor:"#f0fdfa", ...Platform.select({ ios:{shadowColor:"#0f766e",shadowOpacity:0.2,shadowOffset:{width:0,height:4},shadowRadius:12}, android:{elevation:8} }) },
  cardHeader: { flexDirection:"row", alignItems:"center", marginBottom:6, gap:4 },
  dragIcon: { fontSize:16, color:"#94a3b8", letterSpacing:-2, paddingHorizontal:2 },
  cardId: { fontSize:10, color:"#94a3b8", fontWeight:"600" },
  cardAction: { padding:4, borderRadius:6, backgroundColor:"#f1f5f9" },
  cardTitle: { fontSize:13, fontWeight:"800", color:"#0f172a", marginBottom:8, lineHeight:18 },
  cardDesc: { fontSize:12, color:"#64748b", marginBottom:8, lineHeight:17 },
  infoChip: { backgroundColor:"#f1f5f9", borderRadius:8, padding:8, marginBottom:8, gap:3 },
  infoRow: { flexDirection:"row", justifyContent:"space-between", gap:8 },
  infoLabel: { fontSize:10, color:"#94a3b8", fontWeight:"600" },
  infoValue: { fontSize:10, color:"#0f172a", fontWeight:"700", flex:1, textAlign:"right" },
  tagsRow: { flexDirection:"row", flexWrap:"wrap", gap:4, marginBottom:8 },
  tagBadge: { backgroundColor:"#f0fdfa", borderRadius:99, paddingHorizontal:7, paddingVertical:2, borderWidth:1, borderColor:"#99f6e4" },
  tagBadgeText: { fontSize:9, color:"#0f766e", fontWeight:"700" },
  tagMore: { fontSize:10, color:"#94a3b8", alignSelf:"center" },
  cardFooter: { flexDirection:"row", alignItems:"center", marginBottom:6 },
  priBadge: { flexDirection:"row", alignItems:"center", gap:4, paddingHorizontal:7, paddingVertical:3, borderRadius:99 },
  priBadgeText: { fontSize:10, fontWeight:"700" },
  dueLabel: { fontSize:10, fontWeight:"700" },
  dateText: { fontSize:10, color:"#94a3b8" },
  dot: { width:7, height:7, borderRadius:4 },
  emptyState: { flex:1, alignItems:"center", justifyContent:"center", gap:12, padding:32 },
  emptyStateIconWrap: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: "#f0fdfa",
    alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  emptyStateTitle: { fontSize:22, fontWeight:"800", color:"#0f172a", textAlign:"center" },
  emptyStateSub: { fontSize:13, color:"#64748b", textAlign:"center", lineHeight:20 },
  cta: { marginTop:8, paddingHorizontal:24, paddingVertical:12, borderRadius:12, backgroundColor:"#0f766e" },
  ctaText: { color:"#fff", fontWeight:"800", fontSize:14 },
  sheetBackdrop: { flex:1, backgroundColor:"rgba(0,0,0,0.45)" },
  sheet: { backgroundColor:"#fff", borderTopLeftRadius:20, borderTopRightRadius:20, paddingHorizontal:20, paddingBottom:32, paddingTop:12 },
  sheetHandle: { width:40, height:4, borderRadius:2, backgroundColor:"#e2e8f0", alignSelf:"center", marginBottom:16 },
  sheetTitle: { fontSize:16, fontWeight:"800", color:"#0f172a", marginBottom:4 },
  sheetSub: { fontSize:12, color:"#94a3b8", marginBottom:16 },
  sheetRow: { flexDirection:"row", alignItems:"center", gap:12, paddingVertical:14, paddingHorizontal:12, borderRadius:12, marginBottom:6 },
  sheetDot: { width:10, height:10, borderRadius:5 },
  sheetRowText: { fontSize:15, fontWeight:"600", flex:1 },
  sheetCurrent: { fontSize:11, fontWeight:"700" },
  sheetCancel: { marginTop:8, paddingVertical:14, alignItems:"center", borderRadius:12, backgroundColor:"#f1f5f9" },
  sheetCancelText: { fontSize:14, fontWeight:"700", color:"#64748b" },
  modalHeader: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:16, paddingVertical:14, borderBottomWidth:1, borderBottomColor:"#e2e8f0" },
  modalTitle: { fontSize:16, fontWeight:"800", color:"#0f172a" },
  modalClose: { width:32, height:32, borderRadius:8, backgroundColor:"#f1f5f9", alignItems:"center", justifyContent:"center" },
  searchInput: { backgroundColor:"#f8fafc", borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, paddingHorizontal:12, paddingVertical:8, fontSize:13, color:"#0f172a" },
  contactRow: { flexDirection:"row", alignItems:"center", gap:12, paddingVertical:10, borderBottomWidth:1, borderBottomColor:"#f1f5f9" },
  avatar: { width:36, height:36, borderRadius:18, backgroundColor:"#0f766e", alignItems:"center", justifyContent:"center" },
  avatarText: { color:"#fff", fontWeight:"800", fontSize:13 },
  contactName: { fontSize:13, fontWeight:"700", color:"#0f172a" },
  contactSub: { fontSize:11, color:"#94a3b8", marginTop:1 },
  center: { flex:1, alignItems:"center", justifyContent:"center", paddingVertical:40 },
  fieldLabel: { fontSize:10, fontWeight:"800", color:"#94a3b8", letterSpacing:1, marginBottom:6 },
  input: { backgroundColor:"#f8fafc", borderWidth:1, borderColor:"#e2e8f0", borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:13, color:"#0f172a" },
  inputError: { borderColor:"#ef4444" },
  errorText: { fontSize:11, color:"#ef4444", marginTop:4 },
  priorityBtn: { flex:1, flexDirection:"row", alignItems:"center", justifyContent:"center", gap:5, paddingVertical:8, borderRadius:8, borderWidth:1.5 },
  chip: { paddingHorizontal:12, paddingVertical:6, borderRadius:8, borderWidth:1.5 },
  tagChip: { paddingHorizontal:10, paddingVertical:5, borderRadius:99, borderWidth:1 },
  saveBtn: { marginTop:20, backgroundColor:"#0f766e", borderRadius:12, paddingVertical:14, alignItems:"center" },
  saveBtnText: { color:"#fff", fontWeight:"800", fontSize:15 },
  toast: { position:"absolute", bottom:24, left:16, right:16, padding:14, borderRadius:12, borderWidth:1, flexDirection:"row", alignItems:"center", zIndex:100, ...Platform.select({ ios:{shadowColor:"#000",shadowOpacity:0.12,shadowOffset:{width:0,height:4},shadowRadius:12}, android:{elevation:8} }) },
});
