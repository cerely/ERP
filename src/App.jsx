import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Sidenav from './components/Sidenav';
import StatsRow from './components/StatsRow';
import FlowView from './components/FlowView';
import TableView from './components/TableView';
import RightPanel from './components/RightPanel';
import StepModal from './components/StepModal';
import Login from './components/Login';
import UserManagement from './components/UserManagement';
import OrderCreationFlow from './components/OrderCreationFlow';
import OrderList from './components/OrderList';
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
  const [steps, setSteps] = useState(INITIAL_STEPS);
  const [activityLog, setActivityLog] = useState([]);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [currentView, setCurrentView] = useState('flow');
  const [bomState, setBomState] = useState('Accept-Complete');
  const [designType, setDesignType] = useState('Standard');
  const [selectedStepId, setSelectedStepId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const navigate = useNavigate();

  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const token = localStorage.getItem('token');

  useEffect(() => {
    syncProfile();
    fetchLogs();

    const handleSetViewEvent = (e) => {
      if (typeof e.detail === 'string') {
        setCurrentView(e.detail);
      } else if (e.detail && e.detail.view) {
        setCurrentView(e.detail.view);
        if (e.detail.orderId) setSelectedOrderId(e.detail.orderId);
      }
    };
    window.addEventListener('setView', handleSetViewEvent);
    return () => window.removeEventListener('setView', handleSetViewEvent);
  }, []);

  const syncProfile = async () => {
    if (!token) return;
    try {
      const res = await fetch('http://localhost:5000/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const latestUser = await res.json();
        setUser(latestUser);
        localStorage.setItem('user', JSON.stringify(latestUser));
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error('Failed to sync profile', err);
    }
  };

  const fetchLogs = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
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

  const logActivity = async (dept, text) => {
    try {
      await fetch('http://localhost:5000/api/logs', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ dept, action_text: text })
      });
      fetchLogs(); // Refresh logs
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

  const handleSaveStep = (data) => {
    const t = fmtTime(new Date());
    const updatedSteps = steps.map((s) => {
      if (s.id === selectedStepId) {
        let updated = { ...s, status: data.status, notes: data.notes, updated: t };
        if (s.special === 'dispatch' && data.dispatchDate) {
          updated.dispatchDate = data.dispatchDate;
        }
        return updated;
      }
      if (selectedStep.special === 'qc' && data.status === 'blocked' && data.qcFailTarget) {
        if (data.qcFailTarget === 'production' && s.id === 'pr2') {
          return { ...s, status: 'inprogress', notes: 'Returned from QC — rework required', updated: t };
        }
        if (data.qcFailTarget === 'design' && s.id === 'd2') {
          return { ...s, status: 'review', notes: 'Returned from QC — design re-check needed', updated: t };
        }
      }
      return s;
    });

    setSteps(updatedSteps);

    if (selectedStep.special === 'qc' && data.status === 'blocked' && data.qcFailTarget) {
      const routeText = data.qcFailTarget === 'production' 
        ? 'QC FAIL → returned to Production for rework' 
        : 'QC FAIL → returned to Design for re-check';
      logActivity('QC', routeText);
    }
    
    logActivity(selectedStep.dept, `"${selectedStep.name}" → ${data.status.toUpperCase()}${data.notes ? ' — ' + data.notes : ''}`);
    setIsModalOpen(false);
  };

  const handleSetBomState = (state) => {
    if (!['Admin', 'Manager', 'Accounts', 'Production'].includes(user.role)) {
      alert('Unauthorized to change BOM status');
      return;
    }
    setBomState(state);
    logActivity('Stores', `BOM status updated → ${state}`);
  };

  const handleSetDesignType = (type) => {
    if (!['Admin', 'Manager', 'Design'].includes(user.role)) {
      alert('Unauthorized to change Design classification');
      return;
    }
    setDesignType(type);
    logActivity('Design', `Design classified as ${type}`);
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
               'Management'}
            </div>
            <div className="view-toggle">
              <button className={`vbtn${currentView === 'flow' ? ' active' : ''}`} onClick={() => setCurrentView('flow')}>Flow</button>
              <button className={`vbtn${currentView === 'table' ? ' active' : ''}`} onClick={() => setCurrentView('table')}>Table</button>
              <button className={`vbtn${currentView === 'orders' ? ' active' : ''}`} onClick={() => setCurrentView('orders')}>Orders</button>
              {user.role === 'Admin' && (
                <button className={`vbtn${currentView === 'users' ? ' active' : ''}`} onClick={() => setCurrentView('users')}>Users</button>
              )}
            </div>
          </div>

          {currentView === 'flow' ? (
            <FlowView steps={steps} currentFilter={currentFilter} onOpenModal={handleOpenModal} onSetView={setCurrentView} userRole={user.role} />
          ) : currentView === 'table' ? (
            <TableView steps={steps} currentFilter={currentFilter} onOpenModal={handleOpenModal} userRole={user.role} />
          ) : currentView === 'orders' ? (
            <OrderList initialSelectedId={selectedOrderId} />
          ) : currentView === 'new-order' ? (
            <OrderCreationFlow onOrderCreated={() => setCurrentView('orders')} />
          ) : (
            <UserManagement />
          )}
        </main>
        <RightPanel selectedStep={selectedStep} activityLog={activityLog} />
      </div>

      <StepModal
        step={selectedStep}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveStep}
        userRole={user.role}
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
