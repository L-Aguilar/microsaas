import Swal from 'sweetalert2';

export interface PlanLimitError {
  error: 'PLAN_LIMIT_EXCEEDED' | 'MODULE_NOT_AVAILABLE';
  message: string;
  details?: {
    moduleType: string;
    action: string;
    currentCount: number;
    limit: number | null;
  };
}

export class PlanAlertService {
  
  /**
   * Muestra una alerta cuando se alcanza el límite del plan
   */
  static async showLimitReachedAlert(error: PlanLimitError): Promise<boolean> {
    const moduleName = this.getModuleName(error.details?.moduleType || '');
    
    const result = await Swal.fire({
      title: '🚫 Límite Alcanzado',
      text: error.message,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#6c757d',
      confirmButtonText: '📈 Actualizar Plan',
      cancelButtonText: 'Entendido',
      footer: error.details ? 
        `<small>Uso actual: ${error.details.currentCount}/${error.details.limit || '∞'} ${moduleName.toLowerCase()}</small>` 
        : '',
      customClass: {
        container: 'plan-limit-alert',
        title: 'plan-limit-title',
        htmlContainer: 'plan-limit-content'
      }
    });

    return result.isConfirmed;
  }

  /**
   * Muestra una alerta cuando no se tiene acceso al módulo
   */
  static async showModuleNotAvailableAlert(error: PlanLimitError): Promise<boolean> {
    const moduleName = this.getModuleName(error.details?.moduleType || '');
    
    const result = await Swal.fire({
      title: '🔒 Módulo No Disponible',
      html: `
        <p>${error.message}</p>
        <div class="mt-3 p-3 bg-info rounded">
          <small><strong>💡 Tip:</strong> Contacta al administrador para agregar este módulo a tu plan.</small>
        </div>
      `,
      icon: 'info',
      showCancelButton: true,
      confirmButtonColor: '#28a745',
      cancelButtonColor: '#6c757d',
      confirmButtonText: '✉️ Contactar Administrador',
      cancelButtonText: 'Entendido',
      customClass: {
        container: 'module-not-available-alert',
        title: 'module-not-available-title'
      }
    });

    return result.isConfirmed;
  }

  /**
   * Muestra una alerta de confirmación para upgrade/downgrade de plan
   */
  static async showPlanChangeConfirmation(
    action: 'upgrade' | 'downgrade',
    currentPlan: string,
    newPlan: string,
    priceChange: number
  ): Promise<boolean> {
    const isUpgrade = action === 'upgrade';
    const priceText = isUpgrade 
      ? `+$${Math.abs(priceChange)}/mes` 
      : priceChange < 0 
        ? `-$${Math.abs(priceChange)}/mes`
        : 'Sin cambio en el precio';

    const result = await Swal.fire({
      title: `${isUpgrade ? '📈' : '📉'} ${isUpgrade ? 'Actualizar' : 'Reducir'} Plan`,
      html: `
        <div class="text-start">
          <p><strong>Plan actual:</strong> ${currentPlan}</p>
          <p><strong>Nuevo plan:</strong> ${newPlan}</p>
          <p><strong>Cambio en facturación:</strong> <span class="${isUpgrade ? 'text-success' : 'text-warning'}">${priceText}</span></p>
          ${!isUpgrade ? `
            <div class="alert alert-warning mt-3">
              <small><strong>⚠️ Advertencia:</strong> Al reducir tu plan, algunas funciones pueden quedar desactivadas y solo podrás ver el historial.</small>
            </div>
          ` : ''}
        </div>
      `,
      icon: isUpgrade ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonColor: isUpgrade ? '#28a745' : '#ffc107',
      cancelButtonColor: '#6c757d',
      confirmButtonText: `${isUpgrade ? '✅' : '⚠️'} Confirmar Cambio`,
      cancelButtonText: 'Cancelar',
      customClass: {
        container: 'plan-change-alert'
      }
    });

    return result.isConfirmed;
  }

  /**
   * Muestra una alerta de éxito después de un cambio de plan
   */
  static async showPlanChangeSuccess(newPlan: string): Promise<void> {
    await Swal.fire({
      title: '🎉 ¡Plan Actualizado!',
      text: `Tu plan ha sido cambiado exitosamente a: ${newPlan}`,
      icon: 'success',
      confirmButtonColor: '#28a745',
      confirmButtonText: 'Perfecto',
      timer: 3000,
      timerProgressBar: true
    });
  }

  /**
   * Muestra una alerta cuando no se puede reducir usuarios/elementos
   */
  static async showCannotReduceAlert(
    itemType: 'usuarios' | 'empresas' | 'productos',
    currentCount: number,
    newLimit: number
  ): Promise<boolean> {
    const result = await Swal.fire({
      title: '❌ No se puede reducir',
      html: `
        <p>No puedes reducir a <strong>${newLimit} ${itemType}</strong> porque actualmente tienes <strong>${currentCount}</strong>.</p>
        <div class="alert alert-info mt-3">
          <small><strong>💡 Solución:</strong> Primero elimina ${currentCount - newLimit} ${itemType} y luego cambia tu plan.</small>
        </div>
      `,
      icon: 'error',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: `🗂️ Administrar ${itemType}`,
      cancelButtonText: 'Entendido',
      customClass: {
        container: 'cannot-reduce-alert'
      }
    });

    return result.isConfirmed;
  }

  /**
   * Muestra una alerta de loading durante cambios de plan
   */
  static showPlanChangeLoading(): void {
    Swal.fire({
      title: 'Actualizando Plan...',
      html: 'Por favor espera mientras procesamos el cambio.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
  }

  /**
   * Cierra cualquier alerta abierta
   */
  static close(): void {
    Swal.close();
  }

  /**
   * Obtiene el nombre amigable de un módulo
   */
  private static getModuleName(moduleType: string): string {
    const moduleNames: Record<string, string> = {
      'USERS': 'Usuarios',
      'COMPANIES': 'Empresas',
      'CRM': 'CRM',
      'BILLING': 'Facturación',
      'INVENTORY': 'Inventario',
      'HR': 'Recursos Humanos',
      'ANALYTICS': 'Analíticas',
      'REPORTS': 'Reportes',
      'AUTOMATION': 'Automatización'
    };

    return moduleNames[moduleType] || moduleType;
  }
}

/**
 * Hook personalizado para manejar errores de plan límites
 */
export function usePlanErrorHandler() {
  const handlePlanError = async (error: any): Promise<boolean> => {
    if (error?.response?.data?.error === 'PLAN_LIMIT_EXCEEDED') {
      return await PlanAlertService.showLimitReachedAlert(error.response.data);
    }
    
    if (error?.response?.data?.error === 'MODULE_NOT_AVAILABLE') {
      return await PlanAlertService.showModuleNotAvailableAlert(error.response.data);
    }

    // Return false for non-plan errors (let them be handled normally)
    return false;
  };

  return { handlePlanError };
}