import Button from './Button.jsx';
import Modal from './Modal.jsx';

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', loading = false, danger = true }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      )}
    >
      <p className="confirm-message">{message}</p>
    </Modal>
  );
}
