export const DEPTS = [
  { id: 'Sales',      color: 'var(--teal)',   label: 'Sales',      sub: 'Customer interface' },
  { id: 'Design',     color: 'var(--purple)', label: 'Design',     sub: 'Engineering' },
  { id: 'Purchase',   color: 'var(--orange)', label: 'Purchase',   sub: 'Procurement' },
  { id: 'Stores',     color: 'var(--green)',  label: 'Stores',     sub: 'Stock & Issue' },
  { id: 'Production', color: 'var(--red)',    label: 'Production', sub: 'Manufacturing' },
  { id: 'QC',         color: 'var(--blue)',   label: 'QC',         sub: 'Quality Control' },
  { id: 'Dispatch',   color: 'var(--text2)',  label: 'Dispatch',   sub: 'Logistics' },
  { id: 'Accounts',   color: 'var(--text2)',  label: 'Accounts',   sub: 'Billing' },
];

export const INITIAL_STEPS = [
  // Sales
  { id: 's1',  dept: 'Sales',      name: 'Upload PO',               sub: 'Customer PO + specs',                              status: 'done',       notes: '',                       updated: '', special: 'sales' },
  { id: 's2',  dept: 'Sales',      name: 'Confirm Dispatch Date',   sub: 'Received from Planning',                          status: 'pending',    notes: '',                       updated: '', special: 'dispatch', dispatchDate: '' },
  // Design
  { id: 'd1',  dept: 'Design',     name: 'Review & Classify',       sub: 'Standard / Non-Standard',                         status: 'done',       notes: 'Classified as Standard', updated: '' },
  { id: 'd2',  dept: 'Design',     name: 'Release Documents',       sub: 'Panel Layout + Electrical Design + BOM',          status: 'inprogress', notes: '',                       updated: '', special: 'design' },
  // Purchase
  { id: 'p1',  dept: 'Purchase',   name: 'Receive Shortfall',       sub: 'From Stores after BOM check',                     status: 'pending',    notes: '',                       updated: '' },
  { id: 'p2',  dept: 'Purchase',   name: 'Procure Materials',       sub: 'Raise PO to supplier',                            status: 'pending',    notes: '',                       updated: '' },
  // Stores
  { id: 'st1', dept: 'Stores',     name: 'Stock Check vs BOM',      sub: 'Verify availability',                             status: 'inprogress', notes: '',                       updated: '' },
  { id: 'st2', dept: 'Stores',     name: 'Material Status',         sub: 'Allotted → Acceptance → Accept-complete',         status: 'pending',    notes: '',                       updated: '' },
  { id: 'st3', dept: 'Stores',     name: 'Inform Purchase',         sub: 'Send shortfall list',                             status: 'pending',    notes: '',                       updated: '' },
  // Production
  { id: 'pr1', dept: 'Production', name: 'Production Plan',         sub: 'Per day capacity',                                status: 'pending',    notes: '',                       updated: '' },
  { id: 'pr2', dept: 'Production', name: 'Manufacture',             sub: 'Fitter (mechanical) + Wireman (electrical)',       status: 'pending',    notes: '',                       updated: '' },
  // QC
  { id: 'q1',  dept: 'QC',         name: 'Receive Panel',           sub: 'Test & inspect',                                  status: 'pending',    notes: '',                       updated: '', special: 'qc' },
  { id: 'q2',  dept: 'QC',         name: 'QC Decision',             sub: 'Pass → Dispatch | Fail → Rework/Redesign',        status: 'pending',    notes: '',                       updated: '', special: 'qc' },
  // Dispatch
  { id: 'di1', dept: 'Dispatch',   name: 'Ready for Dispatch',      sub: 'QC cleared panels',                               status: 'pending',    notes: '',                       updated: '' },
  // Accounts
  { id: 'ac1', dept: 'Accounts',   name: 'Invoice & Dispatch Note', sub: 'Billing & documentation',                         status: 'pending',    notes: '',                       updated: '' },
];

export const INITIAL_LOG = [
  { time: fmtTime(new Date()), dept: 'Sales',   text: 'PO uploaded — Customer specs received' },
  { time: fmtTime(new Date()), dept: 'Design',  text: 'Panel classified as Standard' },
  { time: fmtTime(new Date()), dept: 'Design',  text: 'Electrical Design in progress' },
  { time: fmtTime(new Date()), dept: 'Stores',  text: 'BOM received — stock check initiated' },
];

export function fmtTime(date) {
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export const STATUS_BADGE_MAP = {
  pending:    { cls: 'badge-pending',    label: 'PENDING' },
  inprogress: { cls: 'badge-inprogress', label: 'IN PROGRESS' },
  done:       { cls: 'badge-done',       label: 'DONE' },
  blocked:    { cls: 'badge-blocked',    label: 'BLOCKED' },
  review:     { cls: 'badge-review',     label: 'REVIEW' },
};
