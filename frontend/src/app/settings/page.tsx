'use client';

import React, { useState } from 'react';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAuthStore } from '@/stores/authStore';
import { useThemeStore } from '@/stores/themeStore';
import { useDashboardStore } from '@/stores/dashboardStore';
import { Card, CardBody, CardHeader, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Toggle, Checkbox } from '@/components/ui/Toggle';
import { Badge } from '@/components/ui/Badge';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { AlertCircle, Lock, Bell, Palette, ToggleRight, Download, RotateCcw } from 'lucide-react';

export default function SettingsPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const user = useAuthStore((state) => state.user);
  const { theme, setTheme, lowStim, toggleLowStim } = useThemeStore();
  const resetLayout = useDashboardStore((state) => state.resetLayout);

  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  const handlePasswordChange = async () => {
    if (passwordData.new !== passwordData.confirm) {
      alert('Le password non corrispondono');
      return;
    }
    alert('Password aggiornata con successo');
    setShowPasswordChange(false);
    setPasswordData({ current: '', new: '', confirm: '' });
  };

  const handleResetLayout = () => {
    resetLayout();
    setShowResetModal(false);
    alert('Layout ripristinato al default');
  };

  return (
    <div className="min-h-screen bg-page flex flex-col">
      <Header onMenuToggle={() => setMenuOpen(!menuOpen)} isMenuOpen={menuOpen} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-heading">Impostazioni</h1>
              <p className="text-body mt-2">Gestisci il tuo profilo e le preferenze</p>
            </div>

            {/* Profile Section */}
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold text-heading flex items-center gap-2">
                  👤 Profilo
                </h2>
              </CardHeader>
              <CardBody className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <Input
                    label="Nome"
                    type="text"
                    value={user?.name || ''}
                    disabled
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={user?.email || ''}
                    disabled
                  />
                </div>
                <Button variant="secondary" size="sm">
                  Modifica profilo
                </Button>
              </CardBody>
            </Card>

            {/* Security Section */}
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold text-heading flex items-center gap-2">
                  <Lock size={20} /> Sicurezza
                </h2>
              </CardHeader>
              <CardBody className="space-y-4">
                {/* Password Change */}
                <div>
                  <h3 className="font-medium text-heading mb-2">Password</h3>
                  {!showPasswordChange ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowPasswordChange(true)}
                    >
                      Cambia password
                    </Button>
                  ) : (
                    <div className="space-y-3 p-4 bg-card-inner rounded-lg">
                      <Input
                        label="Password attuale"
                        type="password"
                        value={passwordData.current}
                        onChange={(e) =>
                          setPasswordData((p) => ({ ...p, current: e.target.value }))
                        }
                      />
                      <Input
                        label="Nuova password"
                        type="password"
                        value={passwordData.new}
                        onChange={(e) =>
                          setPasswordData((p) => ({ ...p, new: e.target.value }))
                        }
                      />
                      <Input
                        label="Conferma password"
                        type="password"
                        value={passwordData.confirm}
                        onChange={(e) =>
                          setPasswordData((p) => ({ ...p, confirm: e.target.value }))
                        }
                      />
                      <div className="flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={handlePasswordChange}
                        >
                          Salva
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowPasswordChange(false)}
                        >
                          Annulla
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2FA */}
                <div className="border-t border-border-default pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-heading">Autenticazione a due fattori</h3>
                      <p className="text-sm text-body mt-1">
                        Proteggi il tuo account con 2FA
                      </p>
                    </div>
                    <Badge variant="success" size="sm">
                      Attivo
                    </Badge>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShow2FAModal(true)}
                    className="mt-3"
                  >
                    Configura 2FA
                  </Button>
                </div>
              </CardBody>
            </Card>

            {/* Appearance Section */}
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold text-heading flex items-center gap-2">
                  <Palette size={20} /> Aspetto
                </h2>
              </CardHeader>
              <CardBody className="space-y-4">
                {/* Theme */}
                <div>
                  <label className="block text-sm font-medium text-body mb-3">
                    Tema
                  </label>
                  <Select
                    options={[
                      { value: 'dark', label: 'Scuro' },
                      { value: 'light', label: 'Chiaro' },
                      { value: 'system', label: 'Sistema' },
                    ]}
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as any)}
                  />
                </div>

                {/* Low Stim Mode */}
                <div className="border-t border-border-default pt-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-heading">
                        Modalità a bassa stimolazione
                      </h3>
                      <p className="text-sm text-body mt-1">
                        Disabilita animazioni, colori morbidi, e interfaccia semplificata
                      </p>
                    </div>
                    <Toggle
                      checked={lowStim}
                      onChange={() => toggleLowStim()}
                    />
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Notifications Section */}
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold text-heading flex items-center gap-2">
                  <Bell size={20} /> Notifiche
                </h2>
              </CardHeader>
              <CardBody className="space-y-4">
                <Checkbox
                  label="Ricevi notifiche per scadenze"
                  defaultChecked
                />
                <Checkbox
                  label="Ricevi notifiche per farmaci"
                  defaultChecked
                />
                <Checkbox
                  label="Ricevi notifiche per abitudini"
                  defaultChecked
                />
                <Checkbox
                  label="Ricevi notifiche push del browser"
                  defaultChecked
                />
                <Checkbox
                  label="Ricevi email di riepilogo settimanali"
                />
              </CardBody>
            </Card>

            {/* Data Section */}
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold text-heading flex items-center gap-2">
                  💾 Dati
                </h2>
              </CardHeader>
              <CardBody className="space-y-4">
                <div>
                  <h3 className="font-medium text-heading mb-2">Esporta dati</h3>
                  <p className="text-sm text-body mb-3">
                    Scarica una copia di tutti i tuoi dati in formato JSON
                  </p>
                  <Button variant="secondary" size="sm">
                    <Download size={16} className="mr-2" />
                    Esporta dati
                  </Button>
                </div>

                {/* Reset Layout */}
                <div className="border-t border-border-default pt-4">
                  <h3 className="font-medium text-heading mb-2">Layout dashboard</h3>
                  <p className="text-sm text-body mb-3">
                    Ripristina il layout predefinito della dashboard
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowResetModal(true)}
                  >
                    <RotateCcw size={16} className="mr-2" />
                    Ripristina
                  </Button>
                </div>
              </CardBody>
            </Card>

            {/* Danger Zone */}
            <Card className="border-red-700">
              <CardHeader>
                <h2 className="text-xl font-semibold text-red-400 flex items-center gap-2">
                  <AlertCircle size={20} /> Zona pericolosa
                </h2>
              </CardHeader>
              <CardBody className="space-y-4">
                <p className="text-sm text-body">
                  Queste azioni sono irreversibili. Procedere con cautela.
                </p>
                <Button variant="danger" size="sm">
                  Elimina account
                </Button>
              </CardBody>
            </Card>
          </div>
        </main>
      </div>

      {/* 2FA Modal */}
      <Modal
        isOpen={show2FAModal}
        onClose={() => setShow2FAModal(false)}
        title="Configura autenticazione a due fattori"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-body">
            Scansiona il codice QR con un'app di autenticazione come Google Authenticator,
            Authy o Microsoft Authenticator.
          </p>
          <div className="bg-input p-4 rounded-lg flex items-center justify-center h-40">
            <p className="text-body">Codice QR placeholder</p>
          </div>
          <Input
            label="Codice di backup"
            value="1234-5678-9012-3456"
            disabled
          />
          <p className="text-xs text-body">
            Salva questo codice in un luogo sicuro. Potrai usarlo per accedere se perdi
            l'accesso al tuo dispositivo di autenticazione.
          </p>
        </div>
      </Modal>

      {/* Reset Confirmation */}
      <ConfirmModal
        isOpen={showResetModal}
        title="Ripristina layout"
        message="Sei sicuro di voler ripristinare il layout della dashboard al default? Questa azione non può essere annullata."
        onConfirm={handleResetLayout}
        onCancel={() => setShowResetModal(false)}
      />
    </div>
  );
}
