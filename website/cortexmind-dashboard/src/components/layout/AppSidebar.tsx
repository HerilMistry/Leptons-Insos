import { Brain, LayoutDashboard, Play, History, FileBarChart, BookOpen, User } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Start Session", url: "/session/start", icon: Play },
  { title: "Session History", url: "/session/history", icon: History },
  { title: "Detailed Report", url: "/detailed-report", icon: FileBarChart },
  { title: "Bibliography", url: "/bibliography", icon: BookOpen },
  { title: "Profile", url: "/profile", icon: User },
];

export default function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar">
      <SidebarContent>
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-5">
          <Brain className="h-7 w-7 text-primary shrink-0" />
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight text-foreground">
              CortexFlow
            </span>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground text-xs uppercase tracking-wider">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="hover:bg-accent/50 transition-colors"
                      activeClassName="bg-primary/15 text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
