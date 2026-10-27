import { createEffect, on } from "solid-js"
import { createStore } from "solid-js/store"
import type { SessionActivityItem } from "./activity-chips"

export type ShellEnd = {
  status: "exited" | "timeout" | "killed"
  exit?: number
  // When the shell stopped, so its run time freezes there.
  completed: number
}

// The background work menu shows either the list or one shell. A shell that ends while it is shown keeps its panel,
// with how it ended, until the user goes back or closes the menu.
export function createShellPanel(input: {
  shells: () => readonly SessionActivityItem[]
  stop: (item: SessionActivityItem) => Promise<boolean>
  // How a shell that left the running list ended; undefined once the server no longer knows it.
  ended: (id: string) => Promise<(Omit<ShellEnd, "completed"> & { completed?: number }) | undefined>
}) {
  const [state, setState] = createStore<{ shell?: SessionActivityItem; stopping: boolean; end?: ShellEnd }>({
    stopping: false,
  })

  const shown = (key: string) => state.shell?.key === key

  createEffect(
    on(
      () => [state.shell, state.end, state.stopping, input.shells()] as const,
      ([shell, end, stopping, shells]) => {
        if (!shell || end || stopping || shells.some((item) => item.key === shell.key)) return
        const key = shell.key

        void input.ended(shell.target).then((info) => {
          if (!shown(key) || state.end) return
          // Removing a running shell ends it as killed, and the server forgets it.
          setState("end", {
            status: info?.status ?? "killed",
            exit: info?.exit,
            completed: info?.completed ?? Date.now(),
          })
        })
      },
    ),
  )

  return {
    state,
    open(item: SessionActivityItem) {
      setState({ shell: item, stopping: false, end: undefined })
    },
    back() {
      setState({ shell: undefined, stopping: false, end: undefined })
    },
    stop() {
      const item = state.shell

      if (!item || state.end || state.stopping) return
      setState("stopping", true)
      void input.stop(item).then((stopped) => {
        if (!shown(item.key)) return
        if (stopped && !state.end) setState("end", { status: "killed", completed: Date.now() })
        setState("stopping", false)
      })
    },
  }
}
