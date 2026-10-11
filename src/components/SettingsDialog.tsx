import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useUserSettings } from "@/lib/useUserSettings";

export function SettingsDialog() {
  const { settings, save } = useUserSettings();
  const [open, setOpen] = useState(false);
  const [agent, setAgent] = useState(settings.agent_name);
  const [page, setPage] = useState(settings.habit_page_name);

  useEffect(() => {
    if (open) {
      setAgent(settings.agent_name);
      setPage(settings.habit_page_name);
    }
  }, [open, settings]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:text-ink"
      >
        Settings
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Personalize</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await save({
                  agent_name: agent.trim().slice(0, 30) || "Mero",
                  habit_page_name: page.trim().slice(0, 30) || "Main habit",
                });
                toast.success("Saved");
                setOpen(false);
              } catch {
                toast.error("Could not save");
              }
            }}
          >
            <label className="block text-sm">
              Agent name
              <Input className="mt-1" value={agent} onChange={(e) => setAgent(e.target.value)} />
            </label>
            <label className="block text-sm">
              Main habit page name
              <Input className="mt-1" value={page} onChange={(e) => setPage(e.target.value)} />
            </label>
            <Button type="submit" className="w-full">Save</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
