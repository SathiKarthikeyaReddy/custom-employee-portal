import React, { useState, useEffect } from 'react';
import roleService from '../services/roleService';
import DataTable from '../components/DataTable';
import RoleBadge from '../components/RoleBadge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Toast from '../components/Toast';
import { Shield, CheckSquare, Plus, Edit2, Trash2, HelpCircle, Lock } from 'lucide-react';

const CORE_ROLES = ['admin', 'hr', 'sales', 'support', 'finance', 'manager'];

export const AdminRolesPage = () => {
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Edit Permissions Modal
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedPermIds, setSelectedPermIds] = useState([]);
  const [permSubmitting, setPermSubmitting] = useState(false);

  // Create / Edit Role Modal
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleModalMode, setRoleModalMode] = useState('create'); // 'create' | 'edit'
  const [roleFormData, setRoleFormData] = useState({ name: '', description: '' });
  const [roleFormErrors, setRoleFormErrors] = useState({});
  const [roleSubmitting, setRoleSubmitting] = useState(false);

  // Delete Role Dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        roleService.list(),
        roleService.listPermissions(),
      ]);
      setRoles(rolesRes.roles || []);
      setPermissions(permsRes.permissions || []);
    } catch (err) {
      console.error('Failed to load roles and permissions:', err);
      setToast({ type: 'error', message: 'Failed to load roles or permissions' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openPermModal = (role) => {
    setSelectedRole(role);
    const existingIds = Array.isArray(role.permissions)
      ? role.permissions.map((p) => p.id)
      : [];
    setSelectedPermIds(existingIds);
    setIsPermModalOpen(true);
  };

  const handlePermToggle = (permId) => {
    setSelectedPermIds((prev) => {
      const current = [...prev];
      const idx = current.indexOf(permId);
      if (idx > -1) {
        current.splice(idx, 1);
      } else {
        current.push(permId);
      }
      return current;
    });
  };

  const handleSavePermissions = async (e) => {
    e.preventDefault();
    if (!selectedRole) return;

    setPermSubmitting(true);
    try {
      await roleService.assignPermissions(selectedRole.id, selectedPermIds);
      setToast({
        type: 'success',
        message: `Updated permissions for role ${selectedRole.name}`,
      });
      setIsPermModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error assigning permissions:', err);
      const msg = err.response?.data?.message || 'Failed to update permissions';
      setToast({ type: 'error', message: msg });
    } finally {
      setPermSubmitting(false);
    }
  };

  const openCreateRoleModal = () => {
    setRoleModalMode('create');
    setRoleFormData({ name: '', description: '' });
    setRoleFormErrors({});
    setIsRoleModalOpen(true);
  };

  const openEditRoleModal = (role) => {
    setRoleModalMode('edit');
    setSelectedRole(role);
    setRoleFormData({ name: role.name, description: role.description || '' });
    setRoleFormErrors({});
    setIsRoleModalOpen(true);
  };

  const handleRoleFormSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!roleFormData.name.trim()) errors.name = 'Role name is required';
    if (Object.keys(errors).length > 0) {
      setRoleFormErrors(errors);
      return;
    }

    setRoleSubmitting(true);
    try {
      if (roleModalMode === 'create') {
        await roleService.create(roleFormData);
        setToast({ type: 'success', message: `Role ${roleFormData.name} created` });
      } else {
        await roleService.update(selectedRole.id, roleFormData);
        setToast({ type: 'success', message: `Role ${roleFormData.name} updated` });
      }
      setIsRoleModalOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error saving role:', err);
      const msg = err.response?.data?.message || 'Failed to save role';
      setToast({ type: 'error', message: msg });
    } finally {
      setRoleSubmitting(false);
    }
  };

  const openDeleteRoleDialog = (role) => {
    setRoleToDelete(role);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteRoleConfirm = async () => {
    if (!roleToDelete) return;
    setDeleteSubmitting(true);
    try {
      await roleService.delete(roleToDelete.id);
      setToast({ type: 'success', message: `Role ${roleToDelete.name} deleted` });
      setIsDeleteDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Failed to delete role:', err);
      const msg = err.response?.data?.message || 'Failed to delete role';
      setToast({ type: 'error', message: msg });
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const columns = [
    {
      title: 'Role',
      key: 'name',
      render: (r) => (
        <div className="flex items-center space-x-2">
          <RoleBadge role={r} />
          <span className="font-heading font-bold text-xs uppercase tracking-wider text-ink-text">
            {r.name}
          </span>
        </div>
      ),
    },
    {
      title: 'Description',
      key: 'description',
      render: (r) => (
        <p className="text-xs text-stone-600 max-w-sm leading-relaxed">
          {r.description || <span className="italic text-stone-400">No description</span>}
        </p>
      ),
    },
    {
      title: 'Active Permission Grants',
      key: 'permissions',
      render: (r) => (
        <div className="flex flex-wrap gap-1 max-w-md">
          {Array.isArray(r.permissions) && r.permissions.length > 0 ? (
            r.permissions.map((p) => (
              <span
                key={p.id}
                className="inline-block font-mono text-[10px] bg-stone-100 border border-stone-300 text-stone-700 px-1.5 py-0.5"
                title={p.label}
              >
                {p.key}
              </span>
            ))
          ) : (
            <span className="text-stone-400 italic text-[11px]">None</span>
          )}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      className: 'text-right',
      cellClassName: 'text-right',
      render: (r) => {
        const isCore = CORE_ROLES.includes(r.name.toLowerCase());
        return (
          <div className="flex items-center justify-end space-x-2">
            <button
              onClick={() => openPermModal(r)}
              className="flex items-center space-x-1 px-2.5 py-1 bg-white border border-border text-xs font-semibold uppercase tracking-wider text-stone-700 hover:text-ink hover:bg-stone-50 transition-colors"
              title="Edit Permissions"
            >
              <Shield className="w-3.5 h-3.5 text-forest" />
              <span>Permissions</span>
            </button>
            <button
              onClick={() => openEditRoleModal(r)}
              className="p-1.5 text-stone-600 hover:text-ink hover:bg-stone-100 border border-transparent hover:border-border transition-colors"
              title="Edit Role"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            {isCore ? (
              <span
                className="p-1.5 text-stone-300 cursor-not-allowed inline-flex items-center"
                title="Core roles cannot be deleted (required for Zoho system mapping)"
              >
                <Lock className="w-3.5 h-3.5" />
              </span>
            ) : (
              <button
                onClick={() => openDeleteRoleDialog(r)}
                className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                title="Delete Custom Role"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      },
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
            Role & Permission Matrix
          </h1>
          <p className="text-xs text-stone-600 mt-0.5">
            Configure authorization rules and application capabilities assigned to organizational roles
          </p>
        </div>

        <button
          onClick={openCreateRoleModal}
          className="flex items-center space-x-2 px-4 py-2 bg-forest hover:bg-[#25583E] text-white font-heading text-xs font-bold uppercase tracking-wider transition-colors border border-[#25583E] self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Custom Role</span>
        </button>
      </div>

      {/* Roles Table */}
      <DataTable
        columns={columns}
        data={roles}
        loading={loading}
        emptyMessage="No roles configured"
      />

      {/* Edit Permissions Modal */}
      <Modal
        isOpen={isPermModalOpen}
        onClose={() => setIsPermModalOpen(false)}
        title={`Configure Permissions: ${selectedRole?.name}`}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSavePermissions} className="space-y-4">
          <p className="text-xs text-stone-600">
            Select the granular authorization privileges to grant to users holding the{' '}
            <strong className="text-ink-text">{selectedRole?.name}</strong> role.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border border-border p-4 bg-stone-50 max-h-96 overflow-y-auto">
            {permissions.map((perm) => {
              const isChecked = selectedPermIds.includes(perm.id);
              return (
                <label
                  key={perm.id}
                  className={`flex items-start space-x-3 p-3 border cursor-pointer transition-colors ${
                    isChecked ? 'bg-white border-forest/50' : 'border-stone-200 hover:bg-stone-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handlePermToggle(perm.id)}
                    className="w-4 h-4 text-forest focus:ring-forest rounded-none border-stone-300 mt-0.5"
                  />
                  <div className="space-y-0.5 flex-1">
                    <div className="text-xs font-heading font-bold text-ink-text">
                      {perm.label}
                    </div>
                    <div className="text-[10px] font-mono text-stone-500">
                      {perm.key}
                    </div>
                    <div className="text-[11px] text-stone-600">
                      {perm.description}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsPermModalOpen(false)}
              disabled={permSubmitting}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-stone-600 hover:text-ink hover:bg-stone-100 border border-border transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={permSubmitting}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-forest hover:bg-[#25583E] transition-colors border border-[#25583E] disabled:opacity-50"
            >
              {permSubmitting ? 'Saving...' : 'Save Permissions'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create / Edit Role Modal */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title={roleModalMode === 'create' ? 'Create Custom Role' : `Edit Role: ${selectedRole?.name}`}
      >
        <form onSubmit={handleRoleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-heading font-bold uppercase tracking-wider text-stone-700 mb-1">
              Role Name
            </label>
            <input
              type="text"
              value={roleFormData.name}
              onChange={(e) => setRoleFormData({ ...roleFormData, name: e.target.value })}
              placeholder="e.g. Operations"
              className={`w-full px-3 py-2 bg-white border text-xs text-ink-text placeholder-stone-400 focus:outline-none focus:border-forest ${
                roleFormErrors.name ? 'border-red-500' : 'border-border'
              }`}
            />
            {roleFormErrors.name && (
              <p className="text-[11px] text-red-600 mt-1 font-medium">{roleFormErrors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-heading font-bold uppercase tracking-wider text-stone-700 mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={roleFormData.description}
              onChange={(e) => setRoleFormData({ ...roleFormData, description: e.target.value })}
              placeholder="Responsibilities and purpose of this role"
              className="w-full px-3 py-2 bg-white border border-border text-xs text-ink-text placeholder-stone-400 focus:outline-none focus:border-forest"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsRoleModalOpen(false)}
              disabled={roleSubmitting}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-stone-600 hover:text-ink hover:bg-stone-100 border border-border transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={roleSubmitting}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-forest hover:bg-[#25583E] transition-colors border border-[#25583E] disabled:opacity-50"
            >
              {roleSubmitting ? 'Saving...' : roleModalMode === 'create' ? 'Create Role' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Role Confirm Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteRoleConfirm}
        title="Delete Custom Role"
        message={`Are you sure you want to delete the '${roleToDelete?.name}' role? Any staff members assigned this role will lose its corresponding permissions.`}
        confirmLabel="Delete Role"
        isDestructive={true}
        loading={deleteSubmitting}
      />
    </div>
  );
};

export default AdminRolesPage;
