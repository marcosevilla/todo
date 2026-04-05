import { toast } from 'sonner'
import { useDetailStore } from '@/stores/detailStore'

/** Show a success toast with a "View" link that opens the task detail page */
export function taskToast(message: string, taskId: string) {
  toast.success(message, {
    action: {
      label: 'View',
      onClick: () => useDetailStore.getState().openTask(taskId),
    },
  })
}
