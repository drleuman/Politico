# ADR-0003 — Arquitectura de Auditoría Append-Only, Hash Chain e Idempotencia Outbox — Política Canon v0.2.18

**Estado:** `ACEPTADO (RATIFICACIÓN HUMANA)`  
**Fecha:** 2026-09-16  
**Fecha de Ratificación:** 2026-09-15  
**Paquete:** `politica-canon-v0.2.18`  
**Responsables:** Arquitectura Técnica / Órgano Promotor Humano  

---

## 1. Contexto

Se requiere registrar todas las operaciones de gobernanza, autenticación y flujo editorial de manera inmutable, ordenada de forma monotónica e infalsificable. La solución debe garantizar idempotencia en workers asíncronos y resistencia a caídas mediante leasing recuperable, aislamiento transaccional mediante savepoints y cola de letras muertas (*dead-letter queue*).

---

## 2. Decisiones y Especificación Ejecutable

### 1. Secuencia Monotónica y Genesis Hash
- La tabla `audit_events` asigna un `sequence_number` entero incremental (`BIGINT CHECK (sequence_number > 0)`) por cada `organization_id`.
- Para el primer evento de una organización (`sequence_number = 1`), el `previous_event_hash` es el **Genesis Hash de 64 ceros**:
  `0000000000000000000000000000000000000000000000000000000000000000`

### 2. Especificación Canónica RFC 8785 (JCS)
El payload de cada evento de auditoría se canonicaliza estrictamente siguiendo **JSON Canonicalization Scheme (JCS / RFC 8785)**:
- **Ordenación de Claves:** Las claves de objetos JSON se ordenan lexicográficamente por sus unidades de código UTF-16.
- **Formato numérico:** Sin ceros a la izquierda, notación exponencial estandarizada.
- **Espaciado:** Cero caracteres de espacio, retorno de carro o salto de línea insignificantes.
- **Codificación:** UTF-8 binario sin BOM.

### 3. Código Fuente del Worker Outbox y Verificador Criptográfico (TypeScript)
> El módulo ejecutable autónomo del worker y el verificador criptográfico de cadena se encuentran en:
> [`src/audit/worker.ts`](../../src/audit/worker.ts)
