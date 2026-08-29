const fs = require('fs');
let code = fs.readFileSync('frontend/src/App.jsx', 'utf8');

// Replace the return block
const searchStr = `  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-50 text-slate-800">
      
      {/* Sonner Toast Notification Container */}
      <Toaster position="top-right" richColors />

      {/* Render Login Screen if user logged out */}
      {!currentUser ? (
        <RoleLoginScreen onLoginSuccess={handleLoginSuccess} />
      ) : activeRole === 'OWNER' ? (
        <OwnerSidebarLayout onLogout={handleLogout} />
      ) : (
        <>
          <Header onLogout={handleLogout} />

          <main className="flex-1 pb-16">`;

const replaceStr = `  if (!currentUser) {
    return (
      <>
        <Toaster position="top-right" richColors />
        <RoleLoginScreen onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-50 text-slate-800">
      
      {/* Sonner Toast Notification Container */}
      <Toaster position="top-right" richColors />

      {activeRole === 'OWNER' ? (
        <OwnerSidebarLayout onLogout={handleLogout} />
      ) : (
        <>
          <Header onLogout={handleLogout} />

          <main className="flex-1 overflow-y-auto pb-16">`;

code = code.replace(searchStr, replaceStr);
fs.writeFileSync('frontend/src/App.jsx', code, 'utf8');
