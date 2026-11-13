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
  ShieldAlert,
  UserX,
  VolumeX,
  Lock,
  Unlock,
  MoreVertical,
  CheckCircle2,
} from 'lucide-react';
import { SocketParticipant } from '@/lib/socket/use-meeting-socket';

interface ParticipantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  participants: SocketParticipant[];
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
}

export function ParticipantDrawer({
  isOpen,
  onClose,
  participants,
  localUser,
  currentUserRole,
  isRoomLocked,
  onToggleRoomLock,
  onMuteParticipant,
  onMuteAll,
  onKickParticipant,
  onAssignRole,
  onToggleLocalHandRaise,
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
    <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-[#0c101c]/95 backdrop-blur-2xl border-l border-white/[0.08] shadow-2xl flex flex-col transition-all duration-300 animate-in slide-in-from-right">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Participants
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.08] text-indigo-300 font-semibold border border-white/[0.05]">
                {totalCount}
              </span>
            </h2>
            <p className="text-xs text-gray-400">Manage attendees & controls</p>
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
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                  : 'bg-white/[0.06] border-white/[0.08] text-gray-300 hover:bg-white/[0.1]'
              }`}
            >
              {isRoomLocked ? (
                <>
                  <Lock className="h-3.5 w-3.5 text-amber-400" />
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

      {/* Raised Hands Highlight Bar */}
      {raisedHands.length > 0 && (
        <div className="p-3 bg-amber-500/10 border-b border-amber-500/20">
          <div className="flex items-center justify-between text-xs text-amber-300 font-semibold mb-2">
            <span className="flex items-center gap-1.5">
              <Hand className="h-3.5 w-3.5 animate-bounce text-amber-400" />
              Raised Hands ({raisedHands.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {raisedHands.map((rh) => (
              <div
                key={rh.id}
                className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded-lg border border-amber-500/20 text-xs text-white"
              >
                <span className="truncate">{rh.name}</span>
                {rh.isLocal ? (
                  <button
                    onClick={onToggleLocalHandRaise}
                    className="text-[11px] text-amber-400 hover:text-amber-300 underline cursor-pointer"
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
            className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500/60"
          />
        </div>
      </div>

      {/* Participants Scroll List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5 divide-y divide-white/[0.04]">
        {/* Local User Card */}
        <div className="pt-1.5 pb-2 flex items-center justify-between rounded-xl px-2 hover:bg-white/[0.02]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {localUser.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-white truncate">{localUser.name}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">
                  You
                </span>
                {currentUserRole === 'HOST' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">
                    Host
                  </span>
                )}
                {currentUserRole === 'CO_HOST' && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium">
                    Co-Host
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 truncate">Current device</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-gray-400">
            {localUser.isHandRaised && (
              <span title="Hand Raised" className="text-amber-400">
                <Hand className="h-3.5 w-3.5 animate-pulse" />
              </span>
            )}
            {localUser.isAudioEnabled ? (
              <Mic className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <MicOff className="h-3.5 w-3.5 text-rose-400" />
            )}
            {localUser.isVideoEnabled ? (
              <Video className="h-3.5 w-3.5 text-indigo-400" />
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
                <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-slate-700 to-slate-800 border border-white/[0.1] flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {p.displayName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-white truncate">{p.displayName}</span>
                    {isParticipantHost && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-medium">
                        Host
                      </span>
                    )}
                    {isParticipantCoHost && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-medium">
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
                  <span title="Hand raised" className="text-amber-400 mr-1">
                    <Hand className="h-3.5 w-3.5 animate-pulse" />
                  </span>
                )}

                {p.isAudioEnabled ? (
                  <Mic className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <MicOff className="h-3.5 w-3.5 text-rose-400" />
                )}

                {p.isVideoEnabled ? (
                  <Video className="h-3.5 w-3.5 text-indigo-400" />
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
                        className="absolute right-0 top-8 z-50 w-44 rounded-xl bg-[#070912] border border-white/[0.12] shadow-2xl p-1.5 space-y-1 animate-in fade-in zoom-in-95"
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
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/[0.08] text-xs text-indigo-300 flex items-center gap-2 cursor-pointer"
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
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          End-to-End Mesh
        </span>
        <button
          onClick={onToggleLocalHandRaise}
          className={`px-3 py-1.5 rounded-xl font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
            localUser.isHandRaised
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
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
