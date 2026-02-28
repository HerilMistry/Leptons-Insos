"""One-shot fix for StartSessionPage.tsx — removes NLP, adds task type buttons."""
import re, sys

path = 'website/cortexmind-dashboard/src/pages/StartSessionPage.tsx'
with open(path, 'r') as f:
    content = f.read()

# ── 1. Replace imports + TASK_ICONS + TaskResult ──────────────
# Pattern: everything from first import line up to (but not including) the DurationPicker heading
new_header = '''import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/hooks/useSession";
import { useToast } from "@/hooks/use-toast";
import AppLayout from "@/components/layout/AppLayout";

// \u2500\u2500\u2500 Task type options \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
const TASK_OPTIONS = [
  { value: "coding",  emoji: "\\ud83d\\udcbb", label: "Coding"           },
  { value: "writing", emoji: "\\u270d\\ufe0f",  label: "Writing"          },
  { value: "reading", emoji: "\\ud83d\\udcd6", label: "Reading"          },
  { value: "video",   emoji: "\\ud83c\\udfac", label: "Lecture / Video" },
  { value: "general", emoji: "\\ud83e\\udde0", label: "General"          },
] as const;

type TaskValue = typeof TASK_OPTIONS[number]["value"];

'''

# Find the boundary: everything up to the DurationPicker comment
duration_marker = '// \u2500\u2500\u2500 Duration Clock Picker'
idx = content.find(duration_marker)
if idx == -1:
    print("ERROR: Could not find DurationPicker marker"); sys.exit(1)

content = new_header + content[idx:]
print("1. Replaced imports + TASK_OPTIONS")

# ── 2. Remove TaskConfirmCard component ──────────────────────
# It sits between DurationPicker's closing } and the Main Page comment
task_confirm_start = content.find('\n// \u2500\u2500\u2500 Task Confirmation Card')
main_page_start    = content.find('\n// \u2500\u2500\u2500 Main Page')
if task_confirm_start != -1 and main_page_start != -1:
    content = content[:task_confirm_start] + '\n' + content[main_page_start:]
    print("2. Removed TaskConfirmCard component")
else:
    print("   TaskConfirmCard not found (may already be removed)")

# ── 3. Update state in StartSessionPage function ──────────────
# Replace the whole state + handlers block (from 'const { activeSession...' 
# through the old handleSubmit closing }; + handleStopCurrent + canStart)
# with the new clean version.
#
# Find start: "const { activeSession, isSessionActive"
# Find end: "const canStart = " line (inclusive)
hook_start_str = '  const { activeSession, isSessionActive, startSession, stopSession } = useSession();'
can_start_str  = '  const canStart = '
hook_start_idx = content.find(hook_start_str)
can_start_idx  = content.find(can_start_str)

if hook_start_idx == -1 or can_start_idx == -1:
    print("ERROR: could not find hooks/canStart boundaries"); sys.exit(1)

# Find end of canStart line
can_start_end = content.find('\n', can_start_idx) + 1  # include newline

new_handlers = '''  const { activeSession, isSessionActive, startSession, stopSession } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();

  // \u2500\u2500 Start Session \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalMinutes < 5) return;

    const option = TASK_OPTIONS.find((o) => o.value === selectedTask)!;
    setSubmitting(true);
    try {
      await startSession({
        task_type: selectedTask as any,
        task_label: option.label,
        task_description: option.label,
        estimated_duration: totalMinutes,
      });
      toast({
        title: "Session started",
        description: `Tracking "${option.label}" \u2014 ${totalMinutes} min.`,
      });
      navigate("/dashboard");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStopCurrent = async () => {
    try {
      await stopSession();
      toast({ title: "Session stopped", description: "Previous session has been saved." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const canStart = totalMinutes >= 5 && !isSessionActive;
'''
content = content[:hook_start_idx] + new_handlers + content[can_start_end:]
print("3. Replaced handlers + canStart")

# ── 4. Replace CardDescription text ──────────────────────────
old_card_desc = "Describe what you&apos;re about to work on \u2014 CortexFlow will detect your task type"
new_card_desc = "Choose your task type and set a duration to begin tracking"
if old_card_desc in content:
    content = content.replace(old_card_desc, new_card_desc)
    print("4. Updated CardDescription")
else:
    print("   CardDescription not found (may already be updated)")

# ── 5. Replace NLP input section with task type buttons ───────
# Find the NLP section comment and its enclosing <div> block
nlp_comment = '{/* \u2500\u2500 Section 1: NLP Task Input'
# Find from comment to the closing </div> of its parent <div className="space-y-3">
idx_nlp = content.find(nlp_comment)
if idx_nlp == -1:
    print("   NLP section not found (may already be removed)"); 
else:
    # Walk from idx_nlp to find the matching </div>
    # The structure is: <div className="space-y-3">  so we need to find its close
    # Approach: find the `{/* ── Section 2:` comment as the boundary
    sec2 = content.find('{/* \u2500\u2500 Section 2: Duration Clock Picker', idx_nlp)
    if sec2 == -1:
        print("ERROR: could not find Section 2 boundary"); sys.exit(1)
    
    # Walk backwards from sec2 to find beginning of whitespace / blank line
    # The NLP section's closing </div> is just before this
    # Find the last </div> before sec2
    # Actually we want to replace everything from nlp_comment's enclosing div start to just before Section 2
    # The enclosing div of nlp_comment begins at the previous '              <div className="space-y-3">'
    # Let's look slightly before nlp_comment for the opening <div
    before_nlp = content.rfind('              <div className="space-y-3">', 0, idx_nlp)
    
    new_task_section = '''              {/* \u2500\u2500 Section 1: Task Type Selector \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
              <div className="space-y-3">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Select Task Mode
                </label>
                <div className="flex flex-wrap gap-3">
                  {TASK_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedTask(opt.value)}
                      className={`flex flex-col items-center gap-1 min-w-[90px] px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-150 ${
                        selectedTask === opt.value
                          ? "border-[#6366f1] bg-[rgba(99,102,241,0.15)] text-white font-medium"
                          : "border-transparent bg-[rgba(255,255,255,0.04)] text-muted-foreground hover:bg-[rgba(255,255,255,0.08)] hover:text-foreground"
                      }`}
                    >
                      <span className="text-xl">{opt.emoji}</span>
                      <span className="text-xs whitespace-nowrap">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

'''
    # Find the end of the NLP section: the </div> that closes the <div className="space-y-3"> 
    # right before sec2. Find the last '\n              </div>\n' before sec2.
    before_sec2 = content[:sec2]
    last_div_close = before_sec2.rfind('\n              </div>\n')
    if last_div_close == -1:
        # Try with extra space indentation
        last_div_close = before_sec2.rfind('              </div>\n')
        print(f"   Fallback div close search: {last_div_close}")
    
    end_of_nlp = last_div_close + len('\n              </div>\n')
    
    content = content[:before_nlp] + new_task_section + content[end_of_nlp:]
    print("5. Replaced NLP section with task type buttons")

with open(path, 'w') as f:
    f.write(content)

print(f"\nDone! File written.")
