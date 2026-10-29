import { CriterioPeso } from './models/cargas.model';

/**
 * La misma regla que aplica la base (cargas.peso_que_vale), para mostrarla
 * en vivo mientras se llena el pesaje. Lo que se guarda lo calcula la base.
 *   - Nuestra báscula pesa igual o más que el cliente → vale el del cliente.
 *   - Pesa menos, hasta el límite (100 kg)             → vale el promedio.
 *   - Pesa menos, por más del límite                    → vale el nuestro.
 */
export function pesoQueVale(empresa: number, cliente: number | null, limite = 100): { kg: number; criterio: CriterioPeso } {
  if (cliente === null || cliente <= 0) return { kg: empresa, criterio: 'EMPRESA' };
  if (empresa >= cliente) return { kg: cliente, criterio: 'CLIENTE' };
  if (cliente - empresa <= limite) return { kg: Math.round(((empresa + cliente) / 2) * 100) / 100, criterio: 'PROMEDIO' };
  return { kg: empresa, criterio: 'EMPRESA' };
}

export const ETIQUETA_CRITERIO: Record<CriterioPeso, string> = {
  EMPRESA: 'el de nuestra báscula',
  CLIENTE: 'el del cliente',
  PROMEDIO: 'el promedio',
  FORMULA: 'el de la fórmula',
};
