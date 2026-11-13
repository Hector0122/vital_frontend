package com.vital.aviso

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.vital.R
import java.util.Calendar

/**
 * Un solo aviso a la semana: domingo 19:00, "tu semana está lista para revisar".
 * Sin librería: AlarmManager + notificación. Si el usuario no dio permiso o las
 * apagó en Android, no se muestra nada. Se reprograma cada vez que arranca la app.
 */
class AvisoDomingo : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val gestor = NotificationManagerCompat.from(context)
    if (!gestor.areNotificationsEnabled()) return
    if (Build.VERSION.SDK_INT >= 26) {
      context.getSystemService(NotificationManager::class.java).createNotificationChannel(
        NotificationChannel(CANAL, "Revisión semanal", NotificationManager.IMPORTANCE_DEFAULT),
      )
    }
    val abrir = PendingIntent.getActivity(
      context, 0,
      context.packageManager.getLaunchIntentForPackage(context.packageName),
      PendingIntent.FLAG_IMMUTABLE,
    )
    val aviso = NotificationCompat.Builder(context, CANAL)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle("Tu semana está lista")
      .setContentText("Mira cómo te fue y, si quieres, elige tus metas ligeras.")
      .setContentIntent(abrir)
      .setAutoCancel(true)
      .build()
    try {
      gestor.notify(1, aviso)
    } catch (e: SecurityException) {
      // Sin permiso POST_NOTIFICATIONS: no se avisa, sin más.
    }
  }

  companion object {
    private const val CANAL = "revision_semanal"

    fun programar(context: Context) {
      val siguiente = Calendar.getInstance().apply {
        set(Calendar.DAY_OF_WEEK, Calendar.SUNDAY)
        set(Calendar.HOUR_OF_DAY, 19)
        set(Calendar.MINUTE, 0)
        set(Calendar.SECOND, 0)
        set(Calendar.MILLISECOND, 0)
        if (timeInMillis <= System.currentTimeMillis()) add(Calendar.WEEK_OF_YEAR, 1)
      }
      val pendiente = PendingIntent.getBroadcast(
        context, 0, Intent(context, AvisoDomingo::class.java),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
      )
      // Inexacta a propósito: no necesita permiso de alarmas exactas y no gasta batería.
      context.getSystemService(AlarmManager::class.java).setInexactRepeating(
        AlarmManager.RTC_WAKEUP, siguiente.timeInMillis, AlarmManager.INTERVAL_DAY * 7, pendiente,
      )
    }
  }
}
