"use client";

import { ClubProvider } from "@/modules/club/session";
import { ClubTabBar } from "@/modules/club/ui/ClubTabBar";
import { JoinClub } from "@/modules/club/ui/JoinClub";
import { AppHeader } from "@/ui";

export function ClubShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="with-tabbar">
        <ClubProvider
          header={<AppHeader backHref="/home" title="Câu lạc bộ" />}
          joinScreen={
            <>
              <AppHeader backHref="/home" title="Câu lạc bộ" />
              <JoinClub onJoined={() => window.location.reload()} />
            </>
          }
        >
          {children}
        </ClubProvider>
      </div>
      <ClubTabBar />
    </>
  );
}
