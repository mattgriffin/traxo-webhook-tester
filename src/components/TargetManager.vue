<script setup>
import { ref } from 'vue';
import { X, Plus, Trash2, Pencil } from 'lucide-vue-next';

const props = defineProps({
  targets: Array,
  modelValue: [String, null], // active target id
});

const emit = defineEmits(['update:modelValue', 'save', 'delete']);

const showModal = ref(false);
const editingId = ref(null);
const form = ref({ name: '', url: '', secret: '' });

function openAdd() {
  editingId.value = null;
  form.value = { name: '', url: '', secret: '' };
  showModal.value = true;
}

function openEdit(target) {
  editingId.value = target.id;
  form.value = { name: target.name, url: target.url, secret: target.secret };
  showModal.value = true;
}

function save() {
  if (!form.value.name || !form.value.url) return;
  emit('save', {
    id: editingId.value || crypto.randomUUID(),
    name: form.value.name,
    url: form.value.url,
    secret: form.value.secret,
  });
  showModal.value = false;
}

function remove(id) {
  if (confirm('Delete this target?')) {
    emit('delete', id);
  }
}
</script>

<template>
  <div class="flex items-end gap-2">
    <div class="sm:w-48">
      <label class="block text-xs font-medium mb-1" style="color: var(--text-muted);">Target</label>
      <select
        :value="modelValue"
        @change="$emit('update:modelValue', $event.target.value)"
        class="w-full rounded-md px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        style="background: var(--bg-input); border: 1px solid var(--border-input); color: var(--text-primary);"
      >
        <option v-if="!targets.length" value="" disabled>No targets</option>
        <option v-for="t in targets" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
    </div>
    <button
      @click="openAdd"
      class="inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-sm transition-colors hover:opacity-80"
      style="background: var(--bg-input); border: 1px solid var(--border-input); color: var(--text-secondary);"
      title="Add target"
    >
      <Plus class="h-4 w-4" />
    </button>
    <button
      v-if="targets.find(t => t.id === modelValue)"
      @click="openEdit(targets.find(t => t.id === modelValue))"
      class="inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-sm transition-colors hover:opacity-80"
      style="background: var(--bg-input); border: 1px solid var(--border-input); color: var(--text-secondary);"
      title="Edit target"
    >
      <Pencil class="h-4 w-4" />
    </button>
    <button
      v-if="targets.find(t => t.id === modelValue)"
      @click="remove(modelValue)"
      class="inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-sm text-red-400 transition-colors hover:opacity-80"
      style="background: var(--bg-input); border: 1px solid var(--border-input);"
      title="Delete target"
    >
      <Trash2 class="h-4 w-4" />
    </button>
  </div>

  <!-- Modal -->
  <Teleport to="body">
    <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center" style="background: var(--bg-overlay);" @click.self="showModal = false">
      <div class="w-full max-w-md rounded-lg p-6 shadow-xl" style="background: var(--bg-card); border: 1px solid var(--border-input);">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold" style="color: var(--text-primary);">{{ editingId ? 'Edit Target' : 'Add Target' }}</h3>
          <button @click="showModal = false" class="hover:opacity-70" style="color: var(--text-faint);">
            <X class="h-5 w-5" />
          </button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium mb-1" style="color: var(--text-muted);">Name</label>
            <input
              v-model="form.name"
              type="text"
              class="w-full rounded-md px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              style="background: var(--bg-input); border: 1px solid var(--border-input); color: var(--text-primary);"
              placeholder="My App (local)"
            />
          </div>
          <div>
            <label class="block text-xs font-medium mb-1" style="color: var(--text-muted);">Webhook URL</label>
            <input
              v-model="form.url"
              type="url"
              class="w-full rounded-md px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              style="background: var(--bg-input); border: 1px solid var(--border-input); color: var(--text-primary);"
              placeholder="http://localhost:8000/webhook/..."
            />
          </div>
          <div>
            <label class="block text-xs font-medium mb-1" style="color: var(--text-muted);">HMAC Secret <span style="color: var(--text-faint);">(optional)</span></label>
            <input
              v-model="form.secret"
              type="text"
              class="w-full rounded-md px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              style="background: var(--bg-input); border: 1px solid var(--border-input); color: var(--text-primary);"
              placeholder="webhook secret"
            />
          </div>
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button @click="showModal = false" class="rounded-md px-4 py-2 text-sm transition-colors hover:opacity-80" style="background: var(--bg-input); border: 1px solid var(--border-input); color: var(--text-secondary);">Cancel</button>
          <button @click="save" :disabled="!form.name || !form.url" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">Save</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
