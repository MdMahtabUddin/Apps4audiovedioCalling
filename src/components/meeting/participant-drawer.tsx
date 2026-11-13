'use client';

import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Hand,
  Shield,
  UserX,
  VolumeX,
  Lock,
  Unlock,
  MoreVertical,
  CheckCircle2,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react';
import { SocketParticipant, WaitingParticipant } from '@/lib/socket/use-meeting-socket';

interface ParticipantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  participants: SocketParticipant[];
  waitingParticipants?: WaitingParticipant[];
  localUser: {
    name: string;
    role: string;
    isAudioEnabled: boolean;
    isVideoEnabled: boolean;
    isHandRaised: boolean;
  };
  currentUserRole: string; // 'HOST' | 'CO_HOST' | 'PARTICIPANT'
  isRoomLocked: boolean;
  onToggleRoomLock: (isLocked: boolean) => void;
  onMuteParticipant: (socketId: string) => void;
  onMuteAll: () => void;
  onKickParticipant: (socketId: string) => void;
  onAssignRole: (socketId: string, role: string) => void;
  onToggleLocalHandRaise: () => void;
  onAdmitParticipant?: (socketId: string) => void;
  onDenyParticipant?: (socketId: string) => void;
  onAdmitAll?: () => void;
}

export function ParticipantDrawer({
  isOpen,
  onClose,
  participants,
  waitingParticipants = [],
  localUser,
  currentUserRole,
  isRoomLocked,
  onToggleRoomLock,
  onMuteParticipant,
  onMuteAll,
  onKickParticipant,
  onAssignRole,
  onToggleLocalHandRaise,
  onAdmitParticipant,
  onDenyParticipant,
  onAdmitAll,
}: ParticipantDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuSocketId, setActiveMenuSocketId] = useState<string | null>(null);
  const [confirmMuteAll, setConfirmMuteAll] = useState(false);

  const isHost = currentUserRole === 'HOST';
  const isCoHost = currentUserRole === 'CO_HOST';
  const hasHostPrivileges = isHost || isCoHost;

  // Filter participants
  const filteredParticipants = useMemo(() => {
    return participants.filter((p) =>
      p.displayName.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );
  }, [participants, searchQuery]);

  // Raised hands collection
  const raisedHands = useMemo(() => {
    const list: Array<{ id: string; name: string; isLocal: boolean; socketId?: string }> = [];
    if (localUser.isHandRaised) {
      list.push({ id: 'local', name: `${localUser.name} (You)`, isLocal: true });
    }
    participants.forEach((p) => {
      if (p.isHandRaised) {
        list.push({ id: p.socketId, name: p.displayName, isLocal: false, socketId: p.socketId });
      }
    });
    return list;
  }, [localUser.isHandRaised, localUser.name, participants]);

  const totalCount = 1 + participants.length;

  if (!isOpen) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-[#091222]/95 backdrop-blur-2xl border-l border-[#0066FF]/20 shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-[#0066FF]/15 border border-[#0066FF]/30 flex items-center justify-center text-[#388BFF]">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Participants
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#0066FF]/20 text-[#388BFF] font-semibold border border-[#0066FF]/30">
                {totalCount}
              </span>
            </h2>
            <p className="text-[11px] text-gray-400">MetroMeet Live Session</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="h-8 w-8 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Host Controls Quick Bar */}
      {hasHostPrivileges && (
        <div className="p-3 bg-white/[0.02] border-b border-white/[0.06] flex items-center justify-between gap-2">
          {/* Mute All Action */}
          {confirmMuteAll ? (
            <div className="flex-1 flex items-center gap-1.5">
              <button
                onClick={() => {
                  onMuteAll();
                  setConfirmMuteAll(false);
                }}
                className="flex-1 py-1.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-md shadow-rose-600/30 cursor-pointer"
              >
                <VolumeX className="h-3.5 w-3.5" />
                <span>Confirm Mute All</span>
              </button>
              <button
                onClick={() => setConfirmMuteAll(false)}
                className="py-1.5 px-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-gray-300 text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmMuteAll(true)}
              className="flex-1 py-1.5 px-3 rounded-xl bg-white/[0.06] hover:bg-rose-500/20 hover:text-rose-300 text-gray-200 text-xs font-medium border border-white/[0.08] hover:border-rose-500/30 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <VolumeX className="h-3.5 w-3.5 text-rose-400" />
              <span>Mute All</span>
            </button>
          )}

          {/* Lock / Unlock Meeting */}
          {isHost && (
            <button
              onClick={() => onToggleRoomLock(!isRoomLocked)}
              className={`py-1.5 px-3 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                isRoomLocked
                  ? 'bg-[#FF7A00]/20 border-[#FF7A00]/40 text-[#FFA033] hover:bg-[#FF7A00]/30'
                  : 'bg-white/[0.06] border-white/[0.08] text-gray-300 hover:bg-white/[0.1]'
              }`}
            >
              {isRoomLocked ? (
                <>
                  <Lock className="h-3.5 w-3.5 text-[#FF7A00]" />
                  <span>Locked</span>
                </>
              ) : (
                <>
                  <Unlock className="h-3.5 w-3.5 text-gray-400" />
                  <span>Unlock</span>
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Waiting Room Knock Section (Host Admission Controls) */}
      {hasHostPrivileges && waitingParticipants.length > 0 && (
        <div className="p-3 bg-gradient-to-r from-[#FF7A00]/15 to-[#0066FF]/15 border-b border-[#FF7A00]/30">
          <div className="flex items-center justify-between text-xs text-[#FFA033] font-bold mb-2">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#FF7A00] animate-ping" />
              Waiting Room ({waitingParticipants.length})
            </span>
            {onAdmitAll && (
              <button
                onClick={onAdmitAll}
                className="text-[11px] text-[#388BFF] hover:underline font-semibold cursor-pointer"
              >
                Admit All
              </button>
            )}
          </div>
          <div className="space-y-2">
            {waitingParticipants.map((wp) => (
              <div
                key={wp.socketId}
                className="flex items-center justify-between bg-black/50 p-2 rounded-xl border border-white/[0.1] text-xs"
              >
                <div className="min-w-0 pr-2">
                  <p className="font-semibold text-white truncate">{wp.displayName}</p>
                  <p className="text-[10px] text-gray-400">Requesting entry</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {onAdmitParticipant && (
                    <button
                      onClick={() => onAdmitParticipant(wp.socketId)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 shadow-sm transition-all cursor-pointer"
                      title="Admit to meeting"
                    >
                      <UserCheck className="h-3 w-3" />
                      <span>Admit</span>
                    </button>
                  )}
                  {onDenyParticipant && (
                    <button
                      onClick={() => onDenyParticipant(wp.socketId)}
                      className="p-1 rounded-lg bg-white/[0.08] hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 transition-all cursor-pointer"
                      title="Decline request"
                    >
                      <UserMinus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raised Hands Highlight Bar */}
      {raisedHands.length > 0 && (
        <div className="p-3 bg-[#FF7A00]/10 border-b border-[#FF7A00]/20">
          <div className="flex items-center justify-between text-xs text-[#FFA033] font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <Hand className="h-3.5 w-3.5 animate-bounce text-[#FF7A00]" />
              Raised Hands ({raisedHands.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {raisedHands.map((rh) => (
              <div
                key={rh.id}
                className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded-lg border border-[#FF7A00]/20 text-xs text-white"
              >
                <span className="truncate">{rh.name}</span>
                {rh.isLocal ? (
                  <button
                    onClick={onToggleLocalHandRaise}
                    className="text-[11px] text-[#FFA033] hover:underline cursor-pointer"
                  >
                    Lower
                  </button>
                ) : hasHostPrivileges && rh.socketId ? (
                  <button
                    onClick={() => onMuteParticipant(rh.socketId!)}
                    className="text-[11px] text-gray-400 hover:text-white cursor-pointer"
                  >
                    Manage
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="p-3 border-b border-white/[0.06]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search participants..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#0066FF]/60"
          />
        </div>
      </div>

      {/* Participants Scroll List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 divide-y divide-white/[0.04]">
        {/* Local User Card */}
        <div className="pt-1.5 pb-2 flex items-center justify-between rounded-xl px-2 hover:bg-white/[0.02]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-[#0057B7] to-[#0066FF] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md shadow-[#0066FF]/30">
              {localUser.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white truncate">{localUser.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0066FF]/20 text-[#388BFF] font-medium">
                  You
                </span>
                {currentUserRole === 'HOST' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FF7A00]/20 text-[#FFA033] font-medium">
                    Host
                  </span>
                )}
                {currentUserRole === 'CO_HOST' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0066FF]/25 text-[#388BFF] font-medium">
                    Co-Host
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 truncate">Current device</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-gray-400">
            {localUser.isHandRaised && (
              <span title="Hand Raised" className="text-[#FF7A00]">
                <Hand className="h-3.5 w-3.5 animate-pulse" />
              </span>
            )}
            {localUser.isAudioEnabled ? (
              <Mic className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <MicOff className="h-3.5 w-3.5 text-rose-400" />
            )}
            {localUser.isVideoEnabled ? (
              <Video className="h-3.5 w-3.5 text-[#388BFF]" />
            ) : (
              <VideoOff className="h-3.5 w-3.5 text-gray-500" />
            )}
          </div>
        </div>

        {/* Remote Participants */}
        {filteredParticipants.map((p) => {
          const isParticipantHost = p.role === 'HOST';
          const isParticipantCoHost = p.role === 'CO_HOST';
          const isMenuOpen = activeMenuSocketId === p.socketId;

          return (
            <div
              key={p.socketId}
              className="pt-2 pb-2 flex items-center justify-between rounded-xl px-2 hover:bg-white/[0.03] transition-colors relative group"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-[#0F2244] to-[#163366] border border-[#0066FF]/30 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {p.displayName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-white truncate">{p.displayName}</span>
                    {isParticipantHost && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#FF7A00]/20 text-[#FFA033] font-medium">
                        Host
                      </span>
                    )}
                    {isParticipantCoHost && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#0066FF]/20 text-[#388BFF] font-medium">
                        Co-Host
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500">Attendee</p>
                </div>
              </div>

              {/* Status Icons & Action Controls */}
              <div className="flex items-center gap-1.5">
                {p.isHandRaised && (
                  <span title="Hand raised" className="text-[#FF7A00] mr-1">
                    <Hand className="h-3.5 w-3.5 animate-pulse" />
                  </span>
                )}

                {p.isAudioEnabled ? (
                  <Mic className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <MicOff className="h-3.5 w-3.5 text-rose-400" />
                )}

                {p.isVideoEnabled ? (
                  <Video className="h-3.5 w-3.5 text-[#388BFF]" />
                ) : (
                  <VideoOff className="h-3.5 w-3.5 text-gray-500" />
                )}

                {/* Host Control Trigger */}
                {hasHostPrivileges && !isParticipantHost && (
                  <div className="relative ml-1">
                    <button
                      onClick={() =>
                        setActiveMenuSocketId(isMenuOpen ? null : p.socketId)
                      }
                      className="h-7 w-7 rounded-lg hover:bg-white/[0.1] text-gray-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                      title="Participant actions"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>

                    {/* Dropdown Menu */}
                    {isMenuOpen && (
                      <div
                        className="absolute right-0 top-8 z-50 w-44 rounded-xl bg-[#091222] border border-[#0066FF]/30 shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95"
                        onMouseLeave={() => setActiveMenuSocketId(null)}
                      >
                        {/* Remote Mute */}
                        {p.isAudioEnabled && (
                          <button
                            onClick={() => {
                              onMuteParticipant(p.socketId);
                              setActiveMenuSocketId(null);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/[0.08] text-xs text-rose-400 flex items-center gap-2 cursor-pointer"
                          >
                            <MicOff className="h-3.5 w-3.5" />
                            <span>Mute audio</span>
                          </button>
                        )}

                        {/* Co-Host Promotion/Demotion */}
                        {isHost && (
                          <button
                            onClick={() => {
                              onAssignRole(
                                p.socketId,
                                isParticipantCoHost ? 'PARTICIPANT' : 'CO_HOST'
                              );
                              setActiveMenuSocketId(null);
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/[0.08] text-xs text-[#388BFF] flex items-center gap-2 cursor-pointer"
                          >
                            <Shield className="h-3.5 w-3.5" />
                            <span>
                              {isParticipantCoHost ? 'Remove Co-Host' : 'Make Co-Host'}
                            </span>
                          </button>
                        )}

                        {/* Kick / Remove */}
                        <button
                          onClick={() => {
                            onKickParticipant(p.socketId);
                            setActiveMenuSocketId(null);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-500/20 text-xs text-rose-400 flex items-center gap-2 cursor-pointer"
                        >
                          <UserX className="h-3.5 w-3.5" />
                          <span>Remove from call</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredParticipants.length === 0 && searchQuery && (
          <div className="py-8 text-center text-xs text-gray-500">
            No participants found matching &quot;{searchQuery}&quot;
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-white/[0.08] bg-white/[0.01] flex items-center justify-between text-xs text-gray-400">
        <span className="flex items-center gap-1.5 text-gray-400">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          MetroNet WebRTC
        </span>
        <button
          onClick={onToggleLocalHandRaise}
          className={`px-3 py-1.5 rounded-xl font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
            localUser.isHandRaised
              ? 'bg-[#FF7A00]/20 border-[#FF7A00]/40 text-[#FFA033]'
              : 'bg-white/[0.06] border-white/[0.08] text-gray-300 hover:bg-white/[0.1]'
          }`}
        >
          <Hand className="h-3.5 w-3.5" />
          <span>{localUser.isHandRaised ? 'Lower Hand' : 'Raise Hand'}</span>
        </button>
      </div>
    </aside>
  );
}
