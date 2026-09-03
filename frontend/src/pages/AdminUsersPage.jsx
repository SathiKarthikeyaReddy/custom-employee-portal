import React, { useState, useEffect } from 'react';
import userService from '../services/userService';
import roleService from '../services/roleService';
import DataTable from '../components/DataTable';
import RoleBadge from '../components/RoleBadge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import { UserPlus, Edit2, Key, Trash2, Check, X, ShieldAlert } from 'lucide-react';

export const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // User modal state (Create / Edit)
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit'
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    isActive: true,
    roleIds: [],
  });
  const [formErrors, setFormErrors] = useState({});
  const [modalSubmitting, setModalSubmitting] = useState(false);

  // Password reset modal state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordResetUser, setPasswordResetUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  // Delete confirm dialog state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        userService.list(),
        roleService.list(),
      ]);
      setUsers(usersRes.users || []);
      setRoles(rolesRes.roles || []);
    } catch (err) {
      console.error('Failed to load users/roles', err);
      setToast({ type: 'error', message: 'Failed to load user records' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setModalMode('create');
    setCurrentUser(null);
    setFormData({
      name: '',
      email: '',
      password: '',
      isActive: true,
      roleIds: [],
    });
    setFormErrors({});
    setIsUserModalOpen(true);
  };

  const openEditModal = (user) => {
    setModalMode('edit');
    setCurrentUser(user);
    // Determine assigned role IDs
    const assignedIds = Array.isArray(user.roles)
      ? user.roles.map((r) => r.id)
      : [];
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      isActive: user.is_active,
      roleIds: assignedIds,
    });
    setFormErrors({});
    setIsUserModalOpen(true);
  };

  const handleRoleToggle = (roleId) => {
    setFormData((prev) => {
      const current = [...prev.roleIds];
      const index = current.indexOf(roleId);
      if (index > -1) {
        current.splice(index, 1);
      } else {
        current.push(roleId);
      }
      return { ...prev, roleIds: current };
    });
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!formData.name.trim()) errors.name = 'Full name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    if (modalMode === 'create' && (!formData.password || formData.password.length < 8)) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setModalSubmitting(true);
    try {
      if (modalMode === 'create') {
        await userService.create({
          name: formData.name.trim(),
          email: formData.email.trim(),
          password: formData.password,
          roleIds: formData.roleIds,
        });
        setToast({ type: 'success', message: `User ${formData.email} created successfully` });
      } else {
        await userService.update(currentUser.id, {
          name: formData.name.trim(),
          email: formData.email.trim(),
          isActive: formData.isActive,
          roleIds: formData.roleIds,
        });
        setToast({ type: 'success', message: `User ${formData.email} updated successfully` });
      }
      setIsUserModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error saving user:', err);
      const msg = err.response?.data?.message || 'Failed to save user record';
      setToast({ type: 'error', message: msg });
    } finally {
      setModalSubmitting(false);
    }
  };

  const openPasswordModal = (user) => {
    setPasswordResetUser(user);
    setNewPassword('');
    setPasswordError('');
    setIsPasswordModalOpen(true);
  };

  const handlePasswordResetSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    setPasswordSubmitting(true);
    try {
      await userService.resetPassword(passwordResetUser.id, newPassword);
      setToast({ type: 'success', message: `Password reset successfully for ${passwordResetUser.email}` });
      setIsPasswordModalOpen(false);
    } catch (err) {
      console.error('Failed to reset password:', err);
      const msg = err.response?.data?.message || 'Failed to reset password';
      setPasswordError(msg);
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const openDeleteDialog = (user) => {
    setUserToDelete(user);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    setDeleteSubmitting(true);
    try {
      await userService.delete(userToDelete.id);
      setToast({ type: 'success', message: `User ${userToDelete.email} has been deleted` });
      setIsDeleteDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to delete user:', err);
      const msg = err.response?.data?.message || 'Failed to delete user';
      setToast({ type: 'error', message: msg });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Name & Email',
      key: 'name',
      render: (u) => (
        <div>
          <div className="font-semibold text-ink-text">{u.name}</div>
          <div className="text-stone-500 font-mono text-[11px]">{u.email}</div>
        </div>
      ),
    },
    {
      title: 'Assigned Roles',
      key: 'roles',
      render: (u) => (
        <div className="flex flex-wrap gap-1">
          {Array.isArray(u.roles) && u.roles.length > 0 ? (
            u.roles.map((r, i) => <RoleBadge key={i} role={r} size="small" />)
          ) : (
            <span className="text-stone-400 italic text-[11px]">None</span>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'is_active',
      render: (u) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            u.is_active
              ? 'bg-forest/10 text-forest border border-forest/30'
              : 'bg-stone-200 text-stone-600 border border-stone-300'
          }`}
        >
          {u.is_active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      className: 'text-right',
      cellClassName: 'text-right',
      render: (u) => (
        <div className="flex items-center justify-end space-x-2">
          <button
            onClick={() => openEditModal(u)}
            className="p-1.5 text-stone-600 hover:text-ink hover:bg-stone-100 border border-transparent hover:border-border transition-colors"
            title="Edit User"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => openPasswordModal(u)}
            className="p-1.5 text-stone-600 hover:text-ink hover:bg-stone-100 border border-transparent hover:border-border transition-colors"
            title="Reset Password"
          >
            <Key className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => openDeleteDialog(u)}
            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
            title="Delete User"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-heading font-bold uppercase tracking-widest text-stone-500">
            Access Control Administration
          </span>
          <h1 className="text-2xl font-heading font-bold text-ink-text uppercase tracking-tight">
            Staff Users Directory
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Manage employee identities, corporate credentials, and role associations
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center space-x-2 px-4 py-2 bg-forest hover:bg-[#25583E] text-white font-heading text-xs font-bold uppercase tracking-wider transition-colors border border-[#25583E] self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New User</span>
        </button>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        emptyMessage="No user accounts registered"
      />

      {/* Create / Edit User Modal */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        title={modalMode === 'create' ? 'Create Staff User' : 'Edit Staff User'}
      >
        <form onSubmit={handleUserSubmit} className="space-y-4" noValidate>
          <div>
            <label className="block text-xs font-heading font-bold uppercase tracking-wider text-stone-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. John Doe"
              className={`w-full px-3 py-2 bg-white border text-xs text-ink-text placeholder-stone-400 focus:outline-none focus:border-forest ${
                formErrors.name ? 'border-red-500' : 'border-border'
              }`}
            />
            {formErrors.name && (
              <p className="text-[11px] text-red-600 mt-1 font-medium">{formErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-heading font-bold uppercase tracking-wider text-stone-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="user@brainwave.io"
              className={`w-full px-3 py-2 bg-white border text-xs text-ink-text placeholder-stone-400 focus:outline-none focus:border-forest ${
                formErrors.email ? 'border-red-500' : 'border-border'
              }`}
            />
            {formErrors.email && (
              <p className="text-[11px] text-red-600 mt-1 font-medium">{formErrors.email}</p>
            )}
          </div>

          {modalMode === 'create' && (
            <div>
              <label className="block text-xs font-heading font-bold uppercase tracking-wider text-stone-700 mb-1">
                Initial Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Minimum 8 characters"
                className={`w-full px-3 py-2 bg-white border text-xs text-ink-text placeholder-stone-400 focus:outline-none focus:border-forest ${
                  formErrors.password ? 'border-red-500' : 'border-border'
                }`}
              />
              {formErrors.password && (
                <p className="text-[11px] text-red-600 mt-1 font-medium">{formErrors.password}</p>
              )}
            </div>
          )}

          {modalMode === 'edit' && (
            <div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-forest focus:ring-forest rounded-none border-stone-300"
                />
                <span className="text-xs font-bold uppercase tracking-wider font-heading text-stone-700">
                  Account Active
                </span>
              </label>
            </div>
          )}

          <div>
            <label className="block text-xs font-heading font-bold uppercase tracking-wider text-stone-700 mb-2">
              Assign Roles
            </label>
            <div className="grid grid-cols-2 gap-2 border border-border p-3 bg-stone-50 max-h-48 overflow-y-auto">
              {roles.map((r) => {
                const isChecked = formData.roleIds.includes(r.id);
                return (
                  <label
                    key={r.id}
                    className={`flex items-center space-x-2 p-2 border cursor-pointer transition-colors ${
                      isChecked ? 'bg-white border-forest/50' : 'border-transparent hover:bg-stone-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleRoleToggle(r.id)}
                      className="w-3.5 h-3.5 text-forest focus:ring-forest rounded-none border-stone-300"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-ink-text">{r.name}</div>
                      <div className="text-[10px] text-stone-500 truncate">{r.description}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsUserModalOpen(false)}
              disabled={modalSubmitting}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-stone-600 hover:text-ink hover:bg-stone-100 border border-border transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={modalSubmitting}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-forest hover:bg-[#25583E] transition-colors border border-[#25583E] disabled:opacity-50"
            >
              {modalSubmitting ? 'Saving...' : modalMode === 'create' ? 'Create User' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title={`Reset Password: ${passwordResetUser?.email}`}
        maxWidth="max-w-md"
      >
        <form onSubmit={handlePasswordResetSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-heading font-bold uppercase tracking-wider text-stone-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              className={`w-full px-3 py-2 bg-white border text-xs text-ink-text placeholder-stone-400 focus:outline-none focus:border-forest ${
                passwordError ? 'border-red-500' : 'border-border'
              }`}
            />
            {passwordError && (
              <p className="text-[11px] text-red-600 mt-1 font-medium">{passwordError}</p>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(false)}
              disabled={passwordSubmitting}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-stone-600 hover:text-ink hover:bg-stone-100 border border-border transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={passwordSubmitting}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-forest hover:bg-[#25583E] transition-colors border border-[#25583E] disabled:opacity-50"
            >
              {passwordSubmitting ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete User Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete User Account"
        message={`Are you sure you want to permanently delete the user account for ${userToDelete?.email}? This action cascades user roles and is recorded in the audit trail.`}
        confirmLabel="Delete User"
        isDestructive={true}
        loading={deleteSubmitting}
      />
    </div>
  );
};

export default AdminUsersPage;
