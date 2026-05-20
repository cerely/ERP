import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Sidenav from './components/Sidenav';
import StatsRow from './components/StatsRow';
import FlowView from './components/FlowView';
import BoardView from './components/BoardView';
import TableView from './components/TableView';
import RightPanel from './components/RightPanel';
import StepModal from './components/StepModal';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import OrderCreationFlow from './components/OrderCreationFlow';
import OrderImport from './components/OrderImport';
import OrderList from './components/OrderList';
import Masters from './components/Masters';
import LogsView from './components/LogsView';
import { INITIAL_STEPS, fmtTime } from './data/planningData';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  
  if (!token || token === 'undefined' || token === 'null' || !user) {
    return <Navigate to="/" replace />;
  }
  
  return children;
};

function Dashboard() {
  const [steps, setSteps] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [currentView, setCurrentView] = useState('orders'); // default to orders so they pick one
  const [bomState, setBomState] = useState('Accept-Complete');
  const [designType, setDesignType] = useState('Standard');
  const [selectedStepId, setSelectedStepId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const selectedOrderIdRef = useRef(null); // ref so closures always see latest value
  const [selectedOrder, setSelectedOrder] = useState(null);
  const navigate = useNavigate();

  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const token = localStorage.getItem('token');

  // Auto-logout on 401
  const authFetch = async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });
    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/');
      return null;
    }
    return res;
  };

  useEffect(() => {
    syncProfile();
    fetchLogs();

    const handleSetViewEvent = (e) => {
      if (typeof e.detail === 'string') {
        setCurrentView(e.detail);
      } else if (e.detail && e.detail.view) {
        setCurrentView(e.detail.view);
        if (e.detail.orderId) {
          setSelectedOrderId(e.detail.orderId);
          selectedOrderIdRef.current = e.detail.orderId;
        } else if (e.detail.orderId === null) {
          setSelectedOrderId(null);
          selectedOrderIdRef.current = null;
        }
      }
    };
    window.addEventListener('setView', handleSetViewEvent);
    return () => window.removeEventListener('setView', handleSetViewEvent);
  }, []);

  useEffect(() => {
    if (selectedOrderId) {
      fetchOrderSteps(selectedOrderId);
      fetchOrderDetails(selectedOrderId);
    } else {
      setSteps([]);
      setSelectedOrder(null);
    }
  }, [selectedOrderId]);

  const fetchOrderDetails = async (orderId) => {
    if (!token) return;
    try {
      const res = await authFetch(`http://localhost:5000/api/orders/${orderId}`);
      if (res?.ok) {
        setSelectedOrder(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch order details', err);
    }
  };

  const fetchOrderSteps = async (orderId) => {
    if (!token) return;
    try {
      const res = await authFetch(`http://localhost:5000/api/orders/${orderId}/steps`);
      if (res?.ok) {
        setSteps(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch steps', err);
    }
  };

  const syncProfile = async () => {
    if (!token) return;
    try {
      const res = await authFetch('http://localhost:5000/api/auth/profile');
      if (res?.ok) {
        const latestUser = await res.json();
        setUser(latestUser);
        localStorage.setItem('user', JSON.stringify(latestUser));
      }
    } catch (err) {
      console.error('Failed to sync profile', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await authFetch('http://localhost:5000/api/logs');
      if (res?.ok) {
        const data = await res.json();
        setActivityLog(data.map(l => ({ 
          time: fmtTime(new Date(l.timestamp)), 
          dept: l.dept, 
          text: l.action_text,
          username: l.username
        })));
      }
    } catch (err) {
      console.error('Failed to fetch logs', err);
    }
  };

  const logActivity = async (dept, text, orderId) => {
    const oid = orderId ?? selectedOrderIdRef.current;
    try {
      const res = await authFetch('http://localhost:5000/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dept, action_text: text, order_id: oid ? parseInt(oid) : null })
      });
      fetchLogs();
    } catch (err) {
      console.error('Failed to log activity', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const selectedStep = steps.find((s) => s.id === selectedStepId) || null;

  const handleOpenModal = (id) => {
    const step = steps.find(s => s.id === id);
    const canEdit = ['Admin', 'Manager'].includes(user.role) || step.dept === user.role;
    
    if (!canEdit) {
      alert(`Access Denied: Your role (${user.role}) is not authorized to edit ${step.dept} tasks.`);
      return;
    }

    setSelectedStepId(id);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSaveStep = async (data) => {
    try {
      const res = await fetch(`http://localhost:5000/api/orders/${selectedOrderId}/steps/${selectedStepId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(data)
      });
      
      if (res.ok) {
        await fetchOrderSteps(selectedOrderId); // refresh steps

        if (selectedStep.special === 'qc' && data.status === 'blocked' && data.qcFailTarget) {
          const routeText = data.qcFailTarget === 'production' 
            ? 'QC FAIL → returned to Production for rework' 
            : 'QC FAIL → returned to Design for re-check';
          logActivity('QC', routeText, selectedOrderId);
        }
        
        logActivity(selectedStep.dept, `"${selectedStep.name}" → ${data.status.toUpperCase()}${data.notes ? ' — ' + data.notes : ''}`, selectedOrderId);
        setIsModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to save step', err);
    }
  };

  const handleDeleteStep = async (stepId) => {
    if (!window.confirm("Are you sure you want to permanently delete this task from the order's flow?")) return;
    try {
      const res = await fetch(`http://localhost:5000/api/orders/${selectedOrderId}/steps/${stepId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchOrderSteps(selectedOrderId);
      } else {
        alert('Failed to delete step');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSetBomState = (state) => {
    if (!['Admin', 'Manager', 'Accounts', 'Production'].includes(user.role)) {
      alert('Unauthorized to change BOM status');
      return;
    }
    setBomState(state);
    logActivity('Stores', `BOM status updated → ${state}`, selectedOrderId);
  };

  const handleSetDesignType = (type) => {
    if (!['Admin', 'Manager', 'Design'].includes(user.role)) {
      alert('Unauthorized to change Design classification');
      return;
    }
    setDesignType(type);
    logActivity('Design', `Design classified as ${type}`, selectedOrderId);
  };

  return (
    <div className="app-container">
      <Header onLogout={handleLogout} />
      <div className="app">
        <Sidenav
          steps={steps}
          currentFilter={currentFilter}
          onFilterDept={setCurrentFilter}
          bomState={bomState}
          onSetBomState={handleSetBomState}
          designType={designType}
          onSetDesignType={handleSetDesignType}
          currentView={currentView}
          onSetView={setCurrentView}
          userRole={user.role}
        />
        <main className="main">
          <StatsRow steps={steps} currentFilter={currentFilter} />
          
          <div className="flow-header">
            <div className="flow-title">
              {currentView === 'flow' ? 'Process Flow' :
               currentView === 'orders' ? 'Order Directory' :
               currentView === 'new-order' ? 'New Order Creation' :
               currentView === 'import' ? 'Bulk Import Orders' :
               currentView === 'masters' ? 'Masters' :
               'Management'}
            </div>
            <div className="view-toggle">
              <button className={`vbtn${currentView === 'board' ? ' active' : ''}`} onClick={() => setCurrentView('board')}>Board</button>
              <button className={`vbtn${currentView === 'flow' ? ' active' : ''}`} onClick={() => setCurrentView('flow')}>Flow</button>
              <button className={`vbtn${currentView === 'table' ? ' active' : ''}`} onClick={() => setCurrentView('table')}>Table</button>
              <button className={`vbtn${currentView === 'orders' ? ' active' : ''}`} onClick={() => setCurrentView('orders')}>Orders</button>
              <button className={`vbtn${currentView === 'masters' ? ' active' : ''}`} onClick={() => setCurrentView('masters')}>Masters</button>
              {['Admin', 'Manager', 'Sales'].includes(user.role) && (
                <button className={`vbtn${currentView === 'import' ? ' active' : ''}`} style={{ background: currentView === 'import' ? '#065f46' : undefined, color: currentView === 'import' ? '#34d399' : undefined }} onClick={() => setCurrentView('import')}>⬆ Import</button>
              )}
              {user.role === 'Admin' && (
                <button className={`vbtn${currentView === 'users' ? ' active' : ''}`} onClick={() => setCurrentView('users')}>Users</button>
              )}
            </div>
          </div>

          {currentView === 'board' ? (
            <BoardView currentFilter={currentFilter} userRole={user.role} onSetView={setCurrentView} />
          ) : currentView === 'flow' ? (
            selectedOrderId ? (
              <FlowView steps={steps} currentFilter={currentFilter} onOpenModal={handleOpenModal} onSetView={setCurrentView} userRole={user.role} selectedOrderId={selectedOrderId} selectedOrder={selectedOrder} onStepsChanged={() => fetchOrderSteps(selectedOrderId)} />
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
                Please select an order from the Header dropdown to view its Process Flow.
              </div>
            )
          ) : currentView === 'table' ? (
            <TableView steps={steps} currentFilter={currentFilter} onOpenModal={handleOpenModal} userRole={user.role} />
          ) : currentView === 'orders' ? (
            <OrderList initialSelectedId={selectedOrderId} />
          ) : currentView === 'new-order' ? (
            <OrderCreationFlow onOrderCreated={() => setCurrentView('orders')} />
          ) : currentView === 'import' ? (
            <OrderImport onImportComplete={() => setCurrentView('orders')} />
          ) : currentView === 'masters' ? (
            <Masters />
          ) : currentView === 'logs' ? (
            <LogsView />
          ) : (
            <UserManagement />
          )}
        </main>
        <RightPanel selectedStep={selectedStep} activityLog={activityLog} selectedOrder={selectedOrder} />
      </div>

      <StepModal
        step={selectedStep}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveStep}
        onDelete={handleDeleteStep}
        userRole={user.role}
        selectedOrder={selectedOrder}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
